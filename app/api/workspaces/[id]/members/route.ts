import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getIO } from "@/lib/socket";

type Role = "ADMIN" | "MEMBER";

type MemberDTO = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  role: Role;
  lastActiveAt: string | null;
};

type PendingInviteDTO = {
  type: "pendingInvite";
  email: string;
  role: Role;
  url: string;
};

async function loadMembershipOr403(workspaceId: string, userId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId },
  });
  return membership;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const myMembership = await loadMembershipOr403(workspaceId, user.id);
    if (!myMembership) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const pageParam = request.nextUrl.searchParams.get("page");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const roleParam = request.nextUrl.searchParams.get("role");
    const query = String(request.nextUrl.searchParams.get("q") ?? "").trim();

    const page = Number(pageParam) || 1;
    const limit = Math.min(50, Math.max(1, Number(limitParam) || 20));
    const offset = (page - 1) * limit;

    const where: import("@prisma/client").Prisma.WorkspaceMemberWhereInput = { workspaceId };
    if (roleParam === "ADMIN" || roleParam === "MEMBER") {
      where.role = roleParam;
    }
    if (query) {
      where.OR = [
        { user: { name: { contains: query, mode: "insensitive" } } },
        { user: { email: { contains: query, mode: "insensitive" } } },
      ];
    }

    const [projectIds, total, members, adminCount] = await Promise.all([
      prisma.project.findMany({
        where: { workspaceId },
        select: { id: true },
      }),
      prisma.workspaceMember.count({ where }),
      prisma.workspaceMember.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, avatarColor: true } },
        },
        orderBy: { user: { name: "asc" } },
        skip: offset,
        take: limit,
      }),
      prisma.workspaceMember.count({ where: { workspaceId, role: "ADMIN" } }),
    ]);

    const projectIdList = projectIds.map((project) => project.id);
    const lastActiveByUser = await Promise.all(
      members.map(async (member) => {
        if (projectIdList.length === 0) return null;
        const activity = await prisma.activity.findFirst({
          where: {
            userId: member.user.id,
            projectId: { in: projectIdList },
          },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        return activity?.createdAt.toISOString() ?? null;
      })
    );

    const dto: MemberDTO[] = members.map((m, index) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarColor: m.user.avatarColor,
      role: m.role as MemberDTO["role"],
      lastActiveAt: lastActiveByUser[index],
    }));

    return NextResponse.json(
      {
        members: dto,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        totalMembers: total,
        totalAdmins: adminCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get members error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const myMembership = await loadMembershipOr403(workspaceId, user.id);
    if (!myMembership || myMembership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only workspace owners can invite members" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const role = body?.role as Role | undefined;
    if (!email || !email.includes("@") || !role || !["ADMIN", "MEMBER"].includes(role)) {
      return NextResponse.json(
        { error: "A valid email and role (ADMIN/MEMBER) are required" },
        { status: 400 }
      );
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const invitee = await prisma.user.findUnique({ where: { email } });
    if (!invitee) {
      return NextResponse.json(
        { error: "No user with that email exists yet" },
        { status: 404 }
      );
    }

    const existing = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: invitee.id },
    });
    if (existing) {
      return NextResponse.json(
        { error: "That user is already a member of this workspace" },
        { status: 409 }
      );
    }

    const pendingInvite = await prisma.workspaceInvite.findFirst({
      where: { workspaceId, email, acceptedAt: null },
    });

    if (pendingInvite) {
      return NextResponse.json(
        { error: "An invitation is already pending for that email" },
        { status: 409 }
      );
    }

    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId,
        email,
        role,
        token: crypto.randomUUID(),
        invitedById: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const notification = await prisma.notification.create({
      data: {
        userId: invitee.id,
        type: "invite",
        message: `${user.name} invited you to join ${workspace.name} as a ${role}.`,
        isRead: false,
      },
    });

    getIO()?.to(`user:${invitee.id}`).emit("notification:created", {
      ...notification,
      createdAt: notification.createdAt.toISOString(),
    });

    const response: PendingInviteDTO & { url: string } = {
      type: "pendingInvite",
      email: invite.email,
      role: invite.role,
      url: `/invite/${invite.token}`,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Invite member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
