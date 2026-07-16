import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspaceId },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this workspace" },
        { status: 404 }
      );
    }

    if (membership.role === "ADMIN") {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId, role: "ADMIN" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          {
            error:
              "You are the only owner. Delete the workspace or promote another member to owner before leaving.",
          },
          { status: 400 }
        );
      }
    }

    await prisma.workspaceMember.delete({ where: { id: membership.id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Leave workspace error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
