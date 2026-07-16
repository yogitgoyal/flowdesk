import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { randomBytes } from "crypto";

const INVITE_TTL_DAYS = 7;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Only ADMINs can create invites
    const myMembership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspaceId },
    });
    if (!myMembership || myMembership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only workspace owners can invite members" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const role = body?.role as "ADMIN" | "MEMBER" | undefined;
    if (!email || !email.includes("@") || !role || !["ADMIN", "MEMBER"].includes(role)) {
      return NextResponse.json(
        { error: "A valid email and role (ADMIN/MEMBER) are required" },
        { status: 400 }
      );
    }

    // Reject if the email already belongs to a current member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId: existingUser.id },
      });
      if (existingMembership) {
        return NextResponse.json(
          { error: "That user is already a member of this workspace" },
          { status: 409 }
        );
      }
    }

    // Revoke any prior unaccepted invite for the same email
    await prisma.workspaceInvite.deleteMany({
      where: { workspaceId, email, acceptedAt: null },
    });

    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId,
        email,
        role,
        token,
        invitedById: user.id,
        expiresAt,
      },
    });

    return NextResponse.json(
      {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        token: invite.token,
        expiresAt: invite.expiresAt.toISOString(),
        // The full URL the owner can copy
        url: `/invite/${invite.token}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}