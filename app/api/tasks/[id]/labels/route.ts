import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getMemberRole, canWrite } from "@/lib/roles";
import { getIO } from "@/lib/socket";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { labelId, name, color } = body;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const project = await prisma.project.findUnique({ where: { id: task.projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const role = await getMemberRole(user.id, project.workspaceId);
    if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canWrite(role)) {
      return NextResponse.json({ error: "Viewers cannot add labels" }, { status: 403 });
    }

    let label;
    if (labelId) {
      label = await prisma.label.findUnique({ where: { id: labelId } });
      if (!label || label.workspaceId !== project.workspaceId) {
        return NextResponse.json({ error: "Invalid labelId for this workspace" }, { status: 400 });
      }
    } else if (name && color) {
      label = await prisma.label.upsert({
        where: { workspaceId_name: { workspaceId: project.workspaceId, name } },
        update: {},
        create: { workspaceId: project.workspaceId, name, color },
      });
    } else {
      return NextResponse.json({ error: "Provide either labelId or name+color" }, { status: 400 });
    }

    await prisma.taskLabel.upsert({
      where: { taskId_labelId: { taskId, labelId: label.id } },
      update: {},
      create: { taskId, labelId: label.id },
    });

    // Broadcast full task with normalised labels to all clients in this project room
    const updatedTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { labels: { include: { label: true } } },
    });
    if (updatedTask) {
      const normalisedTask = {
        ...updatedTask,
        labels: updatedTask.labels.map((tl) => tl.label),
      };
      getIO()?.to(`project:${project.id}`).emit("task:updated", normalisedTask);
    }

    return NextResponse.json(label, { status: 200 });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}