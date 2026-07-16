import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { computeChanges, type TaskSnapshot, type DiffContext } from "@/lib/version-diff";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const project = await prisma.project.findUnique({ where: { id: task.projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspaceId: project.workspaceId },
    });
    if (!workspaceMember) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const versions = await prisma.taskVersion.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });

    if (versions.length === 0) {
      return NextResponse.json({ versions: [] }, { status: 200 });
    }

    const userIds = new Set<string>();
    const columnIds = new Set<string>();
    for (const v of versions) {
      userIds.add(v.editedBy);
      const snap = v.snapshot as TaskSnapshot;
      if (snap.assigneeId) userIds.add(snap.assigneeId);
      if (snap.columnId) columnIds.add(snap.columnId);
    }

    const [users, columns] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: { id: true, name: true, avatarColor: true },
      }),
      prisma.column.findMany({
        where: { id: { in: Array.from(columnIds) } },
        select: { id: true, name: true },
      }),
    ]);

    const ctx: DiffContext = {
      userNames: Object.fromEntries(users.map((u) => [u.id, u.name])),
      columnNames: Object.fromEntries(columns.map((c) => [c.id, c.name])),
    };

    const userMap = new Map(users.map((u) => [u.id, u]));

    const formattedVersions = versions.map((v, i) => {
      const snapshot = v.snapshot as TaskSnapshot;
      const previous = i > 0 ? (versions[i - 1].snapshot as TaskSnapshot) : null;
      const changes = computeChanges(previous, snapshot, ctx);
      const editor = userMap.get(v.editedBy);
      return {
        version: i + 1,
        editedBy: editor?.name ?? "Someone",
        editedAt: v.createdAt.toISOString(),
        user: editor ? { name: editor.name, avatarColor: editor.avatarColor } : null,
        changes,
      };
    });

    return NextResponse.json({ versions: formattedVersions.reverse() }, { status: 200 });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}