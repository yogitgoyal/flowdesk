import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getIO } from "@/lib/socket";
import { getMemberRole, canWrite, canModifyTask } from "@/lib/roles";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { columnId, position, title, description, priority, assigneeId, expectedVersion, dueDate, dueDateLocked, attachmentUrl } = body;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const project = await prisma.project.findUnique({ where: { id: task.projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const role = await getMemberRole(user.id, project.workspaceId);
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canWrite(role)) {
      return NextResponse.json({ error: "Viewers cannot edit tasks" }, { status: 403 });
    }
    if (!canModifyTask(user.id, task, role)) {
      return NextResponse.json(
        { error: "You can only edit tasks assigned to you" },
        { status: 403 }
      );
    }

    // Optimistic locking: reject stale writes with a 409 carrying the current task state.
    // Race note: small window between this read and the update below where another request
    // could increment the version. For a single-server demo this is acceptable; for true
    // race safety, use prisma.task.updateMany({ where: { id, version: expectedVersion }, ... })
    // and inspect result.count, falling back to the same 409 path on 0.
    if (expectedVersion !== undefined && task.version !== expectedVersion) {
      return NextResponse.json(
        { error: "Version conflict", current: task },
        { status: 409 }
      );
    }

    const newTitle = title ?? task.title;

    let newAssigneeName: string | null = null;
    if (assigneeId !== undefined && assigneeId !== null && assigneeId !== task.assigneeId) {
      const u = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { name: true },
      });
      newAssigneeName = u?.name ?? null;
    }

    const changes: Array<{
      action: "task.updated" | "task.assigned";
      metadata: Record<string, string>;
    }> = [];
    if (title !== undefined && title !== task.title) {
      changes.push({ action: "task.updated", metadata: { title: newTitle, field: "title" } });
    }
    if (description !== undefined && description !== task.description) {
      changes.push({ action: "task.updated", metadata: { title: newTitle, field: "description" } });
    }
    if (priority !== undefined && priority !== task.priority) {
      changes.push({ action: "task.updated", metadata: { title: newTitle, field: "priority" } });
    }
    if (assigneeId !== undefined && assigneeId !== task.assigneeId) {
      changes.push({
        action: "task.assigned",
        metadata: {
          title: newTitle,
          assignee: assigneeId === null ? "unassigned" : (newAssigneeName ?? "someone"),
        },
      });
    }

    const shouldNotifyAssignee =
      assigneeId !== undefined &&
      assigneeId !== null &&
      assigneeId !== task.assigneeId &&
      assigneeId !== user.id;

    // "Done" convention: a task counts as complete when it sits in a column
    // literally named "Done" (case-insensitive) — see prisma/schema.prisma
    // and FINAL_BLUEPRINT.md §4. We look this up only when columnId is
    // actually changing, to avoid an extra query on every unrelated PATCH.
    let completedAtUpdate: Date | null | undefined = undefined;
    if (columnId !== undefined && columnId !== task.columnId) {
      const destColumn = await prisma.column.findUnique({ where: { id: columnId } });
      const isDoneColumn = destColumn?.name.trim().toLowerCase() === "done";
      completedAtUpdate = isDoneColumn ? new Date() : null;
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        columnId: columnId ?? task.columnId,
        position: position !== undefined ? position : task.position,
        title: title ?? task.title,
        description: description !== undefined ? description : task.description,
        priority: priority ?? task.priority,
        assigneeId: assigneeId !== undefined ? assigneeId : task.assigneeId,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : task.dueDate,
        dueDateLocked: dueDateLocked !== undefined ? dueDateLocked : task.dueDateLocked,
        attachmentUrl: attachmentUrl !== undefined ? attachmentUrl : task.attachmentUrl,
        ...(completedAtUpdate !== undefined ? { completedAt: completedAtUpdate } : {}),
        version: { increment: 1 },
      },
      include: {
        labels: { include: { label: true } },
      },
    });

    for (const change of changes) {
      await prisma.activity.create({
        data: {
          projectId: project.id,
          taskId: updatedTask.id,
          userId: user.id,
          action: change.action,
          metadata: change.metadata,
        },
      });
    }

    if (changes.length > 0) {
      await prisma.taskVersion.create({
        data: {
          taskId: updatedTask.id,
          editedBy: user.id,
          snapshot: {
            title: updatedTask.title,
            description: updatedTask.description,
            priority: updatedTask.priority,
            assigneeId: updatedTask.assigneeId,
            columnId: updatedTask.columnId,
            position: updatedTask.position,
          },
        },
      });
    }

    // Normalise labels to flat Label[] — matches the shape produced by the
    // dashboard's initial flatTasks mapping and the Task type's labels field.
    const normalisedTask = {
      ...updatedTask,
      labels: updatedTask.labels.map((tl) => tl.label),
    };

    getIO()?.to(`project:${project.id}`).emit("task:updated", normalisedTask);
    // Notify analytics viewers that task counts/metrics may have changed
    getIO()?.to(`project:${project.id}`).emit("analytics:changed", { projectId: project.id, change: "task.updated" });

    if (shouldNotifyAssignee) {
      const notification = await prisma.notification.create({
        data: {
          userId: assigneeId,
          type: "assignment",
          message: `${user.name} assigned you to "${newTitle}"`,
          isRead: false,
        },
      });
      getIO()?.to(`user:${assigneeId}`).emit("notification:created", notification);
    }

    return NextResponse.json(normalisedTask, { status: 200 });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const project = await prisma.project.findUnique({ where: { id: task.projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const role = await getMemberRole(user.id, project.workspaceId);
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canWrite(role)) {
      return NextResponse.json({ error: "Viewers cannot delete tasks" }, { status: 403 });
    }
    if (!canModifyTask(user.id, task, role)) {
      return NextResponse.json(
        { error: "You can only delete tasks assigned to you" },
        { status: 403 }
      );
    }

    await prisma.activity.create({
      data: {
        projectId: project.id,
        taskId: task.id,
        userId: user.id,
        action: "task.deleted",
        metadata: { title: task.title },
      },
    });

    await prisma.task.delete({ where: { id: taskId } });

    getIO()?.to(`project:${project.id}`).emit("task:deleted", taskId);

    // Notify analytics viewers that task counts/metrics may have changed
    getIO()?.to(`project:${project.id}`).emit("analytics:changed", { projectId: project.id, change: "task.deleted" });

    return NextResponse.json({ success: true, id: taskId }, { status: 200 });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}