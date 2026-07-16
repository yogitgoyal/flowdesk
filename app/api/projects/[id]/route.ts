import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const project = await prisma.project.findFirst({
      where: { id: projectId },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              orderBy: { position: 'asc' },
              include: {
                assignee: {
                  select: { id: true, name: true, avatarColor: true },
                },
                labels: {
                  include: { label: true },
                },
              },
            },
          },
        },
      },
    });

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isMember = await prisma.workspaceMember.findFirst({
      where: {
        userId: user.id,
        workspaceId: project.workspaceId,
      },
    });

    if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json(project, { status: 200 });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}