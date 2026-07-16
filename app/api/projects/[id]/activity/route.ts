import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getMemberRole, isAdmin } from "@/lib/roles";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspaceId: project.workspaceId },
    });
    if (!workspaceMember) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const role = await getMemberRole(user.id, project.workspaceId);
    const admin = isAdmin(role);

    const limitParam = request.nextUrl.searchParams.get("limit");
    const pageParam = request.nextUrl.searchParams.get("page");

    let limit = Number(limitParam);
    if (isNaN(limit) || limit <= 0) limit = 8;
    if (limit > 100) limit = 100;

    let page = Number(pageParam);
    if (isNaN(page) || page <= 0) page = 1;

    const where = admin ? { projectId } : { projectId, userId: user.id };

    const [activities, totalCount] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
        include: {
          task: {
            select: {
              title: true,
              priority: true,
              dueDate: true,
              assignee: {
                select: {
                  id: true,
                  name: true,
                  avatarColor: true,
                },
              },
            },
          },
        },
      }),
      prisma.activity.count({ where }),
    ]);

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

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    return NextResponse.json({ activities: responseActivities, totalPages, page, limit }, { status: 200 });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
