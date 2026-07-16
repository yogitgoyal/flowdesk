import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limitParam = request.nextUrl.searchParams.get("limit");
    let limit = Number(limitParam);
    if (isNaN(limit) || limit <= 0) limit = 50;
    if (limit > 100) limit = 100;

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      notifications: notifications.map((n: (typeof notifications)[number]) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      }))
    }, { status: 200 });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}