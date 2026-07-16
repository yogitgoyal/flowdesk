import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getIO } from "@/lib/socket";
import { getMemberRole, canWrite } from "@/lib/roles";

type Task = Awaited<ReturnType<typeof prisma.task.findMany>>[number];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: columnId } = await params;

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { taskIds } = body as { taskIds: string[] };
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: "taskIds must be a non-empty array" }, { status: 400 });
    }

    const column = await prisma.column.findUnique({ where: { id: columnId } });
    if (!column) return NextResponse.json({ error: "Column not found" }, { status: 404 });

    const project = await prisma.project.findUnique({ where: { id: column.projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const role = await getMemberRole(user.id, project.workspaceId);
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canWrite(role)) {
      return NextResponse.json({ error: "Viewers cannot reorder tasks" }, { status: 403 });
    }

    // Every task in the incoming list must belong to this project (not necessarily
    // already this column -- the moved task in a cross-column drag still has its old
    // columnId until this call runs, so we only check project membership here, and
    // this endpoint is what actually moves it into columnId below).
    const existing: Task[] = await prisma.task.findMany({ where: { id: { in: taskIds } } });
    const allBelongToProject =
      existing.length === taskIds.length &&
      existing.every((t: Task) => t.projectId === project.id);
    if (!allBelongToProject) {
      return NextResponse.json({ error: "taskIds do not match this project" }, { status: 400 });
    }

    // RBAC: a MEMBER can freely reorder any task within the same column, and
    // can move their own tasks into a different column, but cannot move a
    // task assigned to someone else into a different column. ADMINs are
    // unrestricted. This mirrors canModifyTask's rule from the task
    // PATCH/DELETE routes, applied here per-task since this endpoint can
    // move a whole batch at once.
    if (role === "MEMBER") {
      const unauthorizedMove = existing.some(
        (t: Task) => t.columnId !== columnId && t.assigneeId !== user.id
      );
      if (unauthorizedMove) {
        return NextResponse.json(
          { error: "You can only move tasks assigned to you into a different column" },
          { status: 403 }
        );
      }
    }

    const isDoneColumn = column.name.trim().toLowerCase() === "done";

    const updated = await prisma.$transaction(
      taskIds.map((taskId, index) => {
        const before = existing.find((e: Task) => e.id === taskId);
        // Preserve the original completedAt if the task was already done and
        // is just being reordered within the same Done column; otherwise set
        // it fresh on entry, or clear it if it left the Done column.
        const completedAt = isDoneColumn
          ? (before?.completedAt ?? new Date())
          : null;

        return prisma.task.update({
          where: { id: taskId },
          data: {
            columnId,
            position: index + 1,
            completedAt,
            version: { increment: 1 },
          },
          select: {
            id: true,
            projectId: true,
            columnId: true,
            title: true,
            description: true,
            assigneeId: true,
            priority: true,
            position: true,
            version: true,
            completedAt: true,
            updatedAt: true,
          },
        });
      })
    );

    type UpdatedTask = (typeof updated)[number];

    const io = getIO();
    if (io) {
      for (const t of updated) {
        io.to(`project:${project.id}`).emit("task:updated", t);
      }
    }

    const movedTasks: UpdatedTask[] = updated.filter((u: UpdatedTask) => {
      const before = existing.find((e: Task) => e.id === u.id);
      return before !== undefined && before.columnId !== u.columnId;
    });

    if (movedTasks.length > 0) {
      const oldColumnIds = Array.from(
        new Set(
          movedTasks
            .map((t: UpdatedTask) => existing.find((e: Task) => e.id === t.id)?.columnId)
            .filter((id): id is string => Boolean(id))
        )
      );

      const oldColumns = await prisma.column.findMany({
        where: { id: { in: oldColumnIds } },
        select: { id: true, name: true },
      });
      const oldColumnMap = new Map(oldColumns.map((c: { id: string; name: string }) => [c.id, c.name]));
      const newColumnName = column.name;

      for (const t of movedTasks) {
        const before = existing.find((e: Task) => e.id === t.id);
        if (!before) continue;
        await prisma.activity.create({
          data: {
            projectId: project.id,
            taskId: t.id,
            userId: user.id,
            action: "task.moved",
            metadata: {
              title: t.title,
              from: oldColumnMap.get(before.columnId) ?? "?",
              to: newColumnName,
            },
          },
        });
        await prisma.taskVersion.create({
          data: {
            taskId: t.id,
            editedBy: user.id,
            snapshot: {
              title: t.title,
              description: t.description,
              priority: t.priority,
              assigneeId: t.assigneeId,
              columnId: t.columnId,
              position: t.position,
            },
          },
        });
      }
    }

    return NextResponse.json({ tasks: updated }, { status: 200 });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}