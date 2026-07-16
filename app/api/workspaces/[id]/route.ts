import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspaceId },
    });
    if (!membership || membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only workspace owners can rename this workspace" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name },
    });

    return NextResponse.json({ id: updated.id, name: updated.name }, { status: 200 });
  } catch (error) {
    console.error("Rename workspace error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspaceId },
    });
    if (!membership || membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only workspace owners can delete this workspace" },
        { status: 403 }
      );
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const confirmName = String(body?.confirmName ?? "").trim();
    if (confirmName !== workspace.name) {
      return NextResponse.json(
        { error: "Type the workspace name exactly to confirm deletion" },
        { status: 400 }
      );
    }

    // No cascade is configured from Project/Task/Column/WorkspaceMember to Workspace,
    // so we must delete in dependency order inside one transaction: tasks (which
    // cascades TaskVersion automatically and SetNulls Activity automatically),
    // then columns, then projects, then members, then finally the workspace itself.
    // WorkspaceInvite IS cascade-configured, so it's cleaned up automatically.
    await prisma.$transaction(async (tx) => {
      const projects = await tx.project.findMany({
        where: { workspaceId },
        select: { id: true },
      });
      const projectIds = projects.map((p) => p.id);

      if (projectIds.length > 0) {
        await tx.task.deleteMany({ where: { projectId: { in: projectIds } } });
        await tx.column.deleteMany({ where: { projectId: { in: projectIds } } });
        await tx.project.deleteMany({ where: { id: { in: projectIds } } });
      }

      await tx.workspaceMember.deleteMany({ where: { workspaceId } });
      await tx.workspace.delete({ where: { id: workspaceId } });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Delete workspace error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
