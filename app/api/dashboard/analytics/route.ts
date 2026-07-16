import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getMemberRole, isAdmin } from "@/lib/roles";

// GET /api/dashboard/analytics?projectId=xxx
// -> { totalTasks, byStatus: [{columnId, columnName, count}], byPriority: {...},
//      avgTimeToDoneHours, tasksCreatedLast7Days: [{date, count}, ...],
//      tasksCreatedPrevious7Days: [{date, count}, ...], scope }
//
// "Done" convention: a task is complete when Task.completedAt is set, which
// happens when it's moved into a column literally named "Done" (see the
// tasks/[id] PATCH route and columns/[id]/renumber route for where that's set).
//
// RBAC: ADMIN sees the whole project; MEMBER sees only tasks assigned to them
// (FINAL_BLUEPRINT.md §7 — analytics is "trimmed to my tasks" for members).

export async function GET(request: NextRequest) {
  const userId = (await getCurrentUser())?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const role = await getMemberRole(userId, project.workspaceId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = isAdmin(role);
  const requestedScope = request.nextUrl.searchParams.get("scope");
  const effectiveScope = !admin
    ? "mine"
    : requestedScope === "mine"
    ? "mine"
    : "workspace";
  const scopeWhere = effectiveScope === "mine" ? { projectId, assigneeId: userId } : { projectId };

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400_000);

  // Tasks Today counts tasks created or due today, whichever is more meaningful
  // for a daily dashboard summary.
  const todayCountWhere = {
    ...scopeWhere,
    OR: [
      { createdAt: { gte: startOfToday, lt: startOfTomorrow } },
      { dueDate: { gte: startOfToday, lt: startOfTomorrow } },
    ],
  };

  const inProgressColumn = await prisma.column.findFirst({
    where: {
      projectId,
      name: { equals: "In Progress", mode: "insensitive" },
    },
    select: { id: true },
  });

  const [
    totalTasks,
    byColumnRaw,
    byPriorityRaw,
    columns,
    doneTasks,
    recentTasks,
    tasksToday,
    inProgressCount,
    dueToday,
    upcomingDeadlines,
  ] = await Promise.all([
    prisma.task.count({ where: scopeWhere }),
    prisma.task.groupBy({ by: ["columnId"], where: scopeWhere, _count: true }),
    prisma.task.groupBy({ by: ["priority"], where: scopeWhere, _count: true }),
    prisma.column.findMany({ where: { projectId }, select: { id: true, name: true } }),
    prisma.task.findMany({
      where: { ...scopeWhere, completedAt: { not: null } },
      select: { createdAt: true, completedAt: true },
    }),
    prisma.task.findMany({
      where: { ...scopeWhere, createdAt: { gte: new Date(Date.now() - 14 * 86400_000) } },
      select: { createdAt: true },
    }),
    prisma.task.count({ where: todayCountWhere }),
    prisma.task.count({
      where: inProgressColumn
        ? { ...scopeWhere, columnId: inProgressColumn.id }
        : { ...scopeWhere, columnId: "__missing__" },
    }),
    prisma.task.count({
      where: {
        ...scopeWhere,
        dueDate: { gte: startOfToday, lt: startOfTomorrow },
      },
    }),
    prisma.task.findMany({
      where: {
        ...scopeWhere,
        dueDate: { gt: startOfTomorrow },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        assignee: { select: { id: true, name: true, avatarColor: true } },
      },
    }),
  ]);

  const countsByColumnId = new Map(byColumnRaw.map((row) => [row.columnId, row._count]));
  const byStatus = columns.map((column) => ({
    columnId: column.id,
    columnName: column.name,
    count: countsByColumnId.get(column.id) ?? 0,
  }));

  const byPriority: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
  for (const row of byPriorityRaw) {
    byPriority[row.priority] = row._count;
  }

  const avgTimeToDoneHours =
    doneTasks.length === 0
      ? null
      : doneTasks.reduce((sum, t) => {
          const hours = (t.completedAt!.getTime() - t.createdAt.getTime()) / 3_600_000;
          return sum + hours;
        }, 0) / doneTasks.length;

  const dayBuckets = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(startOfToday.getTime() - i * 86400_000);
    dayBuckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const t of recentTasks) {
    const key = t.createdAt.toISOString().slice(0, 10);
    if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
  }

  const orderedDays = Array.from(dayBuckets.entries()).map(([date, count]) => ({ date, count }));
  const tasksCreatedPrevious7Days = orderedDays.slice(0, 7);
  const tasksCreatedLast7Days = orderedDays.slice(7);

  return NextResponse.json({
    scope: effectiveScope,
    totalTasks,
    byStatus,
    byPriority,
    avgTimeToDoneHours,
    tasksCreatedLast7Days,
    tasksCreatedPrevious7Days,
    tasksToday,
    inProgressCount,
    dueToday,
    progressPercent: totalTasks === 0 ? 0 : Math.round((doneTasks.length / totalTasks) * 100),
    upcomingDeadlines: upcomingDeadlines.map((task) => ({
      ...task,
      dueDate: task.dueDate?.toISOString() ?? null,
    })),
  });
}
