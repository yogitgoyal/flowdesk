import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token },
      include: {
        workspace: { select: { id: true, name: true } },
        invitedBy: { select: { name: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "This invite has already been accepted" }, { status: 410 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
    }

    return NextResponse.json(
      {
        email: invite.email,
        role: invite.role,
        workspace: invite.workspace,
        invitedByName: invite.invitedBy.name,
        expiresAt: invite.expiresAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}