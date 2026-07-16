import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

declare global {
  // eslint-disable-next-line no-var
  var __flowdeskIO: Server | undefined;
}

type PresenceEntry = {
  userId: string;
  projectId: string;
  taskId: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __flowdeskPresence: Map<string, PresenceEntry> | undefined;
}

type FieldLockEntry = {
  userId: string;
  userName: string;
  userAvatarColor: string;
  projectId: string;
  taskId: string;
  field: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __flowdeskFieldLocks: Map<string, FieldLockEntry> | undefined;
}

export const setIO = (server: HttpServer) => {
  if (!globalThis.__flowdeskIO) {
    globalThis.__flowdeskIO = new Server(server, { path: '/socket.io' });
  }
};

export const getIO = (): Server | null => {
  return globalThis.__flowdeskIO ?? null;
};

export const setPresence = (socketId: string, entry: PresenceEntry): void => {
  if (!globalThis.__flowdeskPresence) {
    globalThis.__flowdeskPresence = new Map();
  }
  globalThis.__flowdeskPresence.set(socketId, entry);
};

export const clearPresence = (socketId: string): string | null => {
  const presenceMap = globalThis.__flowdeskPresence;
  if (!presenceMap) return null;
  const entry = presenceMap.get(socketId);
  if (!entry) return null;
  presenceMap.delete(socketId);
  return entry.projectId;
};

export const getProjectPresenceMap = (projectId: string): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  const presenceMap = globalThis.__flowdeskPresence;
  if (!presenceMap) return result;
  presenceMap.forEach((entry) => {
    if (entry.projectId === projectId && entry.taskId !== null) {
      if (!result[entry.taskId]) {
        result[entry.taskId] = [];
      }
      result[entry.taskId].push(entry.userId);
    }
  });
  return result;
};

export const setFieldLock = (socketId: string, entry: FieldLockEntry): void => {
  if (!globalThis.__flowdeskFieldLocks) {
    globalThis.__flowdeskFieldLocks = new Map();
  }
  globalThis.__flowdeskFieldLocks.set(`${socketId}:${entry.taskId}:${entry.field}`, entry);
};

export const clearFieldLock = (socketId: string): string | null => {
  const lockMap = globalThis.__flowdeskFieldLocks;
  if (!lockMap) return null;
  const prefix = `${socketId}:`;
  let projectId: string | null = null;
  const toDelete: string[] = [];
  lockMap.forEach((entry, key) => {
    if (key.startsWith(prefix)) {
      projectId = entry.projectId;
      toDelete.push(key);
    }
  });
  toDelete.forEach((k) => lockMap.delete(k));
  return projectId;
};

export const getProjectFieldLocks = (
  projectId: string,
): Record<string, { userId: string; userName: string; userAvatarColor: string }> => {
  const result: Record<string, { userId: string; userName: string; userAvatarColor: string }> = {};
  const lockMap = globalThis.__flowdeskFieldLocks;
  if (!lockMap) return result;
  lockMap.forEach((entry) => {
    if (entry.projectId === projectId) {
      result[`${entry.taskId}:${entry.field}`] = {
        userId: entry.userId,
        userName: entry.userName,
        userAvatarColor: entry.userAvatarColor,
      };
    }
  });
  return result;
};

type WorkspacePresenceEntry = {
  userId: string;
  userName: string;
  userAvatarColor: string;
  workspaceId: string;
  status: 'online' | 'viewing' | 'editing' | 'away';
};

declare global {
  // eslint-disable-next-line no-var
  var __flowdeskWorkspacePresence: Map<string, WorkspacePresenceEntry> | undefined;
}

export const setWorkspacePresence = (socketId: string, entry: WorkspacePresenceEntry): void => {
  if (!globalThis.__flowdeskWorkspacePresence) {
    globalThis.__flowdeskWorkspacePresence = new Map();
  }
  globalThis.__flowdeskWorkspacePresence.set(socketId, entry);
};

export const clearWorkspacePresence = (socketId: string): string | null => {
  const map = globalThis.__flowdeskWorkspacePresence;
  if (!map) return null;
  const entry = map.get(socketId);
  if (!entry) return null;
  map.delete(socketId);
  return entry.workspaceId;
};

export const getWorkspacePresenceList = (workspaceId: string): WorkspacePresenceEntry[] => {
  const map = globalThis.__flowdeskWorkspacePresence;
  if (!map) return [];
  const rank: Record<WorkspacePresenceEntry['status'], number> = {
    editing: 3,
    viewing: 2,
    online: 1,
    away: 0,
  };
  const byUser = new Map<string, WorkspacePresenceEntry>();
  map.forEach((entry) => {
    if (entry.workspaceId !== workspaceId) return;
    const existing = byUser.get(entry.userId);
    if (!existing || rank[entry.status] > rank[existing.status]) {
      byUser.set(entry.userId, entry);
    }
  });
  return Array.from(byUser.values());
};