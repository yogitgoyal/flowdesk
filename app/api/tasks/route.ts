import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getIO } from "@/lib/socket";
import { getMemberRole, canWrite } from "@/lib/roles";

// NEW for Week 5 — Week 4 never had a paginated/searchable task list; the
// Kanban board always fetched the whole project at once (fine for a board,
// but the rubric wants an explicit paginate/search/filter/sort surface).
// This is deliberately a *separate* endpoint from the board fetch — don't
// paginate the board itself, you need the full column data to render it.
// Good use for this: an "All tasks" table view, or a search dropdown.
//
// Query params to support: ?projectId=&page=&pageSize=&search=&priority=&assigneeId=&sortBy=&sortDir=
export async function GET(request: NextRequest) {
  const userId = (await getCurrentUser())?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const projectId = params.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
  const search = params.get("search")?.trim() || undefined;
  const priority = params.get("priority") || undefined;
  const assigneeId = params.get("assigneeId") || undefined;
  const sortByParam = params.get("sortBy") || "createdAt";
  const sortDir = params.get("sortDir") === "asc" ? "asc" : "desc";

  // Tenant check — same pattern every other route in this repo uses.
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const role = await getMemberRole(userId, project.workspaceId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Whitelist sortable columns so an arbitrary query param can't be used to
  // sort by (or probe for) a field that isn't meant to be exposed this way.
  const sortableFields = ["createdAt", "updatedAt", "priority", "dueDate", "title", "position"] as const;
  type SortableField = (typeof sortableFields)[number];
  const sortBy: SortableField = sortableFields.includes(sortByParam as SortableField)
    ? (sortByParam as SortableField)
    : "createdAt";

  const where = {
    projectId,
    ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    ...(priority ? { priority: priority as any } : {}),
    ...(assigneeId ? { assigneeId } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        assignee: { select: { id: true, name: true, avatarColor: true } },
        labels: { include: { label: true } },
      },
    }),
  ]);

  const normalisedItems = items.map((t) => ({
    ...t,
    labels: t.labels.map((tl) => tl.label),
  }));

  return NextResponse.json({
    items: normalisedItems,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(request: NextRequest) {
  try {
    const userId = (await getCurrentUser())?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { projectId, columnId, title, description, assigneeId, priority, dueDate, dueDateLocked } = body;

    if (!projectId || !columnId || !title) {
      return NextResponse.json({ error: "projectId, columnId, and title are required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const role = await getMemberRole(userId, project.workspaceId);
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canWrite(role)) {
      return NextResponse.json({ error: "Viewers cannot create tasks" }, { status: 403 });
    }

    const columnExists = await prisma.column.findUnique({ where: { id: columnId } });
    if (!columnExists || columnExists.projectId !== projectId) {
      return NextResponse.json({ error: "Invalid columnId for this project" }, { status: 400 });
    }

    const highestPosition = await prisma.task.findMany({
      where: { columnId },
      orderBy: { position: "desc" },
      take: 1,
    });
    const newPosition = highestPosition.length > 0 ? highestPosition[0].position + 1 : 1;

    const task = await prisma.task.create({
      data: {
        projectId,
        columnId,
        title,
        description: description || null,
        assigneeId: assigneeId || userId,
        priority: priority || "MEDIUM",
        dueDate: dueDate ? new Date(dueDate) : null,
        dueDateLocked: dueDateLocked ?? false,
        position: newPosition,
      },
    });

    // If the task was created directly into a column named "Done", mark it complete.
    const createdColumn = await prisma.column.findUnique({ where: { id: columnId } });
    if (createdColumn && createdColumn.name.trim().toLowerCase() === "done") {
      await prisma.task.update({ where: { id: task.id }, data: { completedAt: new Date() } });
    }

    await prisma.activity.create({
      data: {
        projectId,
        taskId: task.id,
        userId,
        action: "task.created",
        metadata: { title: task.title },
      },
    });

    await prisma.taskVersion.create({
      data: {
        taskId: task.id,
        editedBy: userId,
        snapshot: {
          title: task.title,
          description: task.description,
          priority: task.priority,
          assigneeId: task.assigneeId,
          columnId: task.columnId,
          position: task.position,
        },
      },
    });

    getIO()?.to(`project:${projectId}`).emit("task:created", task);
    // Notify analytics viewers that task counts changed
    getIO()?.to(`project:${projectId}`).emit("analytics:changed", { projectId, change: "task.created" });

    // Notify the assignee if the task was created with someone other than
    // the creator assigned — mirrors the same notification the PATCH route
    // already sends when an assignee is CHANGED on an existing task. Without
    // this, only re-assignment triggered a notification; assigning someone
    // at creation time silently skipped it.
    if (task.assigneeId && task.assigneeId !== userId) {
      const creator = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      const notification = await prisma.notification.create({
        data: {
          userId: task.assigneeId,
          type: "assignment",
          message: `${creator?.name ?? "Someone"} assigned you to "${task.title}"`,
          isRead: false,
        },
      });
      getIO()?.to(`user:${task.assigneeId}`).emit("notification:created", notification);
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}