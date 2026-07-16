import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getMemberRole, canWrite } from '@/lib/roles';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workspaceId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isMember = await prisma.workspaceMember.findFirst({
      where: {
        userId: user.id,
        workspaceId: workspaceId,
      },
    });
    if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const projects = await prisma.project.findMany({
      where: { workspaceId: workspaceId },
      select: {
        id: true,
        name: true,
        workspaceId: true,
      },
    });

    return NextResponse.json(projects, { status: 200 });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workspaceId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const name = body?.name?.trim();

    if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

    const role = await getMemberRole(user.id, workspaceId);
    if (!role || !canWrite(role)) {
      return NextResponse.json(
        { error: "You do not have permission to create projects in this workspace" },
        { status: 403 }
      );
    }

    const project = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const newProject = await tx.project.create({
        data: {
          name,
          workspaceId,
        },
      });

      await Promise.all([
        tx.column.create({
          data: {
            projectId: newProject.id,
            name: "To Do",
            position: 1,
          },
        }),
        tx.column.create({
          data: {
            projectId: newProject.id,
            name: "In Progress",
            position: 2,
          },
        }),
        tx.column.create({
          data: {
            projectId: newProject.id,
            name: "Done",
            position: 3,
          },
        }),
      ]);

      return newProject;
    });

    return NextResponse.json({ id: project.id, name: project.name, workspaceId }, { status: 201 });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

