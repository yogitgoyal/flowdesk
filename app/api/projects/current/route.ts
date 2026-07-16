import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const project = await prisma.project.findFirst({
      where: {
        workspace: {
          members: {
            some: { userId: user.id },
          },
        },
      },
      orderBy: {
        workspace: { createdAt: "asc" },
      },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: "No project available" }, { status: 404 });
    }

    return NextResponse.json(project, { status: 200 });
  } catch (error) {
    console.error("Current project error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Internal server error", detail }, { status: 500 });
  }
}