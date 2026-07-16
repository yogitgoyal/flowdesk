import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: { userId: user.id },
        },
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        _count: {
          select: { members: true },
        },
      },
    });

    const result = workspaces.map((w: typeof workspaces[number]) => ({
      id: w.id,
      name: w.name,
      ownerId: w.ownerId,
      memberCount: w._count.members,
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const name = body?.name?.trim();

    if (!name) return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });

    const workspaceId = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const newWorkspace = await tx.workspace.create({
        data: {
          name,
          ownerId: user.id,
        },
      });
      await tx.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: newWorkspace.id,
          role: "ADMIN",
        },
      });
      return newWorkspace.id;
    });

    return NextResponse.json(
      { id: workspaceId, name, ownerId: user.id, memberCount: 1 },
      { status: 201 }
    );
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
