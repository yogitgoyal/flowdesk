// Shared frontend type definitions, derived directly from prisma/schema.prisma.
// Despite the filename (kept only so existing imports across the app don't
// need touching), this file contains NO mock/fake data anymore -- every type
// here mirrors the real database schema.

export type Role = "ADMIN" | "MEMBER";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

// Activity.action is a plain String column in the schema (not a Prisma enum),
// so this stays a broad string type rather than a strict union -- constraining
// it without a full inventory of every action string used across the API
// routes risks breaking activity-format.ts on an action it doesn't recognize.
export type ActivityAction = string;

export type User = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
};

export type Workspace = {
  id: string;
  name: string;
  ownerId: string;
  memberCount?: number;
};

export type Column = {
  id: string;
  projectId?: string;
  name: string;
  position: number;
};

export type Label = {
  id: string;
  workspaceId?: string;
  name: string;
  color: string;
};

export type Task = {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueDateLocked: boolean;
  assigneeId: string | null;
  assignee?: User | null;
  priority: Priority;
  position: number;
  version: number;
  completedAt: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
  labels?: Label[];
};