import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token },
    });
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "Already accepted" }, { status: 410 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invite expired" }, { status: 410 });
    }

    // The user accepting must match the invited email (case-insensitive)
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        { error: `This invite was sent to ${invite.email} — sign in with that account to accept` },
        { status: 403 }
      );
    }

    // Create the membership (or no-op if already a member)
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
      update: { role: invite.role },
      create: {
        workspaceId: invite.workspaceId,
        userId: user.id,
        role: invite.role,
      },
    });

    // Mark the invite as accepted
    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    return NextResponse.json(
      { workspaceId: invite.workspaceId, role: invite.role },
      { status: 200 }
    );
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}