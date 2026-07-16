import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const project = await prisma.project.findUnique({ where: { id: task.projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspaceId: project.workspaceId },
    });
    if (!workspaceMember) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const activities = await prisma.activity.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const userIds = new Set(activities.map((a) => a.userId));
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, avatarColor: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const responseActivities = activities.map((activity) => ({
      ...activity,
      createdAt: activity.createdAt.toISOString(),
      user: userMap.get(activity.userId) ?? null,
      metadata: activity.metadata as Record<string, string> | null,
    }));

    return NextResponse.json({ activities: responseActivities }, { status: 200 });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}