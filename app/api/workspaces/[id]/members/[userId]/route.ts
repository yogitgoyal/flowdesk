import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: workspaceId, userId: targetUserId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const myMembership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspaceId },
    });
    if (!myMembership || myMembership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only workspace owners can change roles" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const newRole = body?.role as "ADMIN" | "MEMBER" | undefined;
    if (!newRole || !["ADMIN", "MEMBER"].includes(newRole)) {
      return NextResponse.json({ error: "A valid role is required" }, { status: 400 });
    }

    const target = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Prevent removing the last ADMIN
    if (target.role === "ADMIN" && newRole !== "ADMIN") {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId, role: "ADMIN" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last owner of the workspace" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role: newRole },
      include: {
        user: { select: { id: true, name: true, email: true, avatarColor: true } },
      },
    });

    return NextResponse.json(
      {
        id: updated.user.id,
        name: updated.user.name,
        email: updated.user.email,
        avatarColor: updated.user.avatarColor,
        role: updated.role,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Change role error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: workspaceId, userId: targetUserId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const myMembership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspaceId },
    });
    if (!myMembership || myMembership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only workspace admins can remove members" },
        { status: 403 }
      );
    }

    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: "Admins cannot remove themselves from the workspace" },
        { status: 400 }
      );
    }

    const targetMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
    });
    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMember.role === "ADMIN") {
      const adminCount = await prisma.workspaceMember.count({
        where: { workspaceId, role: "ADMIN" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last admin from the workspace" },
          { status: 400 }
        );
      }
    }

    await prisma.workspaceMember.delete({ where: { id: targetMember.id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}