import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function getMemberRole(
  userId: string,
  workspaceId: string
): Promise<Role | null> {
  const member = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId },
    select: { role: true },
  });
  return member?.role ?? null;
}

// Simplified for Week 5's Admin/Member RBAC (was Owner/Editor/Viewer in Week 4).
export function isAdmin(role: Role | null): boolean {
  return role === "ADMIN";
}

export function canWrite(role: Role | null): boolean {
  // Both roles can CRUD tasks in this 2-role model; ADMIN additionally
  // gates workspace/member management (see the workspace routes).
  return role === "ADMIN" || role === "MEMBER";
}

export function canModifyTask(
  userId: string,
  task: { assigneeId: string | null },
  role: Role | null
): boolean {
  if (role === "ADMIN") return true;
  if (role === "MEMBER") return task.assigneeId === userId;
  return false;
}