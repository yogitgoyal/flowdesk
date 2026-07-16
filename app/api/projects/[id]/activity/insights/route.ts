import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspaceId: project.workspaceId },
    });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Compute start-of-today and start-of-yesterday in UTC
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setUTCDate(startOfYesterday.getUTCDate() - 1);

    const [todayCount, yesterdayCount] = await Promise.all([
      prisma.activity.count({
        where: { projectId, createdAt: { gte: startOfToday } },
      }),
      prisma.activity.count({
        where: {
          projectId,
          createdAt: { gte: startOfYesterday, lt: startOfToday },
        },
      }),
    ]);

    const percentChange =
      yesterdayCount === 0
        ? todayCount > 0
          ? 100
          : 0
        : Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);

    // Top contributors today
    const todayActivities = await prisma.activity.findMany({
      where: { projectId, createdAt: { gte: startOfToday } },
      select: { userId: true },
    });

    const contributorCounts = new Map<string, number>();
    for (const a of todayActivities) {
      contributorCounts.set(a.userId, (contributorCounts.get(a.userId) ?? 0) + 1);
    }

    const contributorIds = Array.from(contributorCounts.keys());
    const contributorUsers = contributorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: contributorIds } },
          select: { id: true, name: true, avatarColor: true },
        })
      : [];

    const topContributors = contributorUsers
      .map((u) => ({
        userId: u.id,
        name: u.name,
        avatarColor: u.avatarColor,
        count: contributorCounts.get(u.id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json(
      { todayCount, yesterdayCount, percentChange, topContributors },
      { status: 200 }
    );
  } catch (error) {
    console.error("Activity insights error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
