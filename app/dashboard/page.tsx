"use client";

import SideRail from "@/components/SideRail";
import { apiFetch } from "@/lib/api-client";
import PresenceBar from "@/components/PresenceBar";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

import TopBar from "@/components/TopBar";
import TaskCard from "@/components/TaskCard";
import TaskDrawer from "@/components/TaskDrawer";
import BoardColumn from "@/components/BoardColumn";
import { User, Task, ActivityAction } from "@/lib/mock-data";
import { useSearchStore } from "@/lib/searchStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { formatActivityMessage, formatTimestamp } from "@/lib/activity-format";
import { io, Socket } from "socket.io-client";

type ApiTask = Omit<Task, "labels"> & {
  assignee: User | null;
  projectId: string;
  labels: { label: { id: string; name: string; color: string } }[];
};

type ApiColumn = {
  id: string;
  name: string;
  position: number;
  tasks: ApiTask[];
};

type ApiProject = {
  id: string;
  workspaceId: string;
  name: string;
  columns: ApiColumn[];
};

type Column = { id: string; name: string; position: number };

function formatShortDate(dateString: string | null) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

type DashboardAnalyticsResponse = {
  scope: "workspace" | "mine";
  totalTasks: number;
  byStatus: { columnId: string; columnName: string; count: number }[];
  byPriority: Record<string, number>;
  avgTimeToDoneHours: number | null;
  tasksCreatedLast7Days: { date: string; count: number }[];
  tasksToday: number;
  inProgressCount: number;
  dueToday: number;
  progressPercent: number;
  upcomingDeadlines: {
    id: string;
    title: string;
    dueDate: string | null;
    priority: string;
    assignee: { id: string; name: string; avatarColor: string } | null;
  }[];
};

type DashboardActivity = {
  id: string;
  action: string;
  createdAt: string;
  user: { id: string; name: string; avatarColor: string } | null;
  task: {
    title: string;
    priority: string;
    dueDate: string | null;
    assignee: { id: string; name: string; avatarColor: string } | null;
  } | null;
  metadata: Record<string, string> | null;
};

async function persistColumnRenumber(
  columnId: string,
  taskIds: string[],
  onForbidden: (message: string) => void
): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/columns/${columnId}/renumber`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds }),
    });
    if (res.status === 403) {
      const body = await res.json();
      onForbidden(body.error ?? "You do not have permission to do that.");
      return false;
    }
    if (!res.ok) {
      console.error("Failed to renumber column:", await res.json());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Network error renumbering column:", err);
    return false;
  }
}

async function createTask(
  columnId: string,
  projectId: string,
  title: string,
  onForbidden: (message: string) => void,
  payload?: {
    assigneeId?: string | null;
    priority?: Task["priority"];
    dueDate?: string | null;
    dueDateLocked?: boolean;
  }
) {
  try {
    const res = await apiFetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, columnId, title, ...payload }),
    });
    if (res.status === 403) {
      const body = await res.json();
      onForbidden(body.error ?? "You do not have permission to do that.");
      return null;
    }
    if (!res.ok) {
      console.error("Failed to create task:", await res.json());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Network error creating task:", err);
    return null;
  }
}

async function deleteTaskRequest(
  taskId: string,
  onForbidden: (message: string) => void
) {
  try {
    const res = await apiFetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.status === 403) {
      const body = await res.json();
      onForbidden(body.error ?? "You do not have permission to do that.");
      return false;
    }
    if (!res.ok) {
      console.error("Failed to delete task:", await res.json());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Network error deleting task:", err);
    return false;
  }
}

async function updateTaskRequest(
  taskId: string,
  updates: Partial<{
    title: string;
    description: string | null;
    priority: Task["priority"];
    assigneeId: string | null;
    dueDate: string | null;
    dueDateLocked: boolean;
    expectedVersion?: number;
  }>,
  onConflict: (current: { title?: string; [key: string]: unknown }) => void,
  onForbidden: (message: string) => void
) {
  try {
    const res = await apiFetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.status === 409) {
      const body = await res.json();
      onConflict(body.current);
      return null;
    }
    if (res.status === 403) {
      const body = await res.json();
      onForbidden(body.error ?? "You do not have permission to do that.");
      return null;
    }
    if (!res.ok) {
      console.error("Failed to update task:", await res.json());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Network error updating task:", err);
    return null;
  }
}

export default function DashboardPage() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<(Task & { projectId?: string })[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setAvailableLabels] = useState<{ id: string; name: string; color: string }[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ taskTitle: string } | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentProject = useWorkspaceStore((s) => s.currentProject);
  const setCurrentProject = useWorkspaceStore((s) => s.setCurrentProject);
  const currentProjectId = currentProject?.id ?? null;
  const [presence, setPresence] = useState<Record<string, string[]>>({});
  const [analytics, setAnalytics] = useState<DashboardAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [activityFeed, setActivityFeed] = useState<DashboardActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [fieldLocks, setFieldLocks] = useState<
    Record<string, { userId: string; userName: string; userAvatarColor: string }>
  >({});
  const query = useSearchStore((s) => s.query);
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const setSelectedWorkspaceId = useWorkspaceStore((s) => s.setSelectedWorkspaceId);
  const [reloadKey, setReloadKey] = useState(0);
  const [creatingProject, setCreatingProject] = useState(false);
  const [workspacePresence, setWorkspacePresence] = useState<
    { userId: string; userName: string; userAvatarColor: string; status: "online" | "viewing" | "editing" | "away" }[]
  >([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  async function loadAnalytics(projectId: string) {
    setAnalyticsError(null);
    setAnalyticsLoading(true);
    try {
      const res = await apiFetch(`/api/dashboard/analytics?projectId=${projectId}`);
      if (!res.ok) throw new Error("Could not load dashboard metrics");
      setAnalytics(await res.json());
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : "Failed to load dashboard metrics");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function loadActivityFeed(projectId: string) {
    setActivityError(null);
    setActivityLoading(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/activity?limit=5`);
      if (!res.ok) throw new Error("Could not load recent activity");
      const data = await res.json();
      setActivityFeed(data.activities ?? []);
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : "Failed to load recent activity");
    } finally {
      setActivityLoading(false);
    }
  }

  useEffect(() => {
    if (!currentProjectId) return;
    (async () => {
      await loadAnalytics(currentProjectId);
      await loadActivityFeed(currentProjectId);
    })();
  }, [currentProjectId]);

  useEffect(() => {
    async function loadBoard() {
      try {
        setLoading(true);
        setError(null);

        const meRes = await apiFetch("/api/auth/me");
        if (!meRes.ok) throw new Error("Not authenticated");
        const me = await meRes.json();
        setCurrentUserId(me.id);
        setCurrentUser(me);

        // If SideRail hasn't picked a workspace yet, fetch the list ourselves,
        // pick the first one, and store it -- this also puts SideRail and the
        // board in sync, since they share the same useWorkspaceStore. Once
        // set, this effect re-runs (selectedWorkspaceId is a dependency below)
        // and falls through to the real loading logic on the next pass.
        const workspaceId = selectedWorkspaceId;
        if (!workspaceId) {
          const wsRes = await apiFetch("/api/workspaces");
          if (!wsRes.ok) throw new Error("Could not load workspaces");
          const workspaces = await wsRes.json();
          if (!workspaces.length) throw new Error("No workspace found for this user");
          setSelectedWorkspaceId(workspaces[0].id);
          return;
        }

        const projRes = await apiFetch(`/api/workspaces/${workspaceId}/projects`);
        if (!projRes.ok) throw new Error("Could not load projects");
        const projects = await projRes.json();
        if (!projects.length) throw new Error("No project found in this workspace");

        const detailRes = await apiFetch(`/api/projects/${projects[0].id}`);
        if (!detailRes.ok) throw new Error("Could not load project detail");
        const project: ApiProject = await detailRes.json();
        setCurrentProject({ id: project.id, name: project.name });

        const flatColumns: Column[] = project.columns.map((c) => ({
          id: c.id,
          name: c.name,
          position: c.position,
        }));

        const flatTasks: Task[] = project.columns.flatMap((c) =>
          c.tasks.map((t) => ({
            ...t,
            labels: t.labels.map((tl: { label: { id: string; name: string; color: string } }) => tl.label),
          }))
        );

        setColumns(flatColumns);
        setTasks(flatTasks);

        // Fetch every real workspace member (not just task assignees) so that
        // presence/field-lock lookups can resolve ANY logged-in viewer, not
        // only people who happen to be assigned to a task. Without this, two
        // real concurrent viewers could still fail the "2+ viewers" presence
        // wash check if either of them isn't a task assignee.
        const membersRes = await apiFetch(`/api/workspaces/${workspaceId}/members`);
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setUsers(
            membersData.members.map((m: { id: string; name: string; email: string; avatarColor: string }) => ({
              id: m.id,
              name: m.name,
              email: m.email,
              avatarColor: m.avatarColor,
            }))
          );
        } else {
          // Fallback: derive from assignees only, same as before, so the
          // board doesn't fully break if the members endpoint fails for
          // some reason.
          const uniqueUsersMap = new Map<string, User>();
          for (const c of project.columns) {
            for (const t of c.tasks) {
              if (t.assignee) uniqueUsersMap.set(t.assignee.id, t.assignee);
            }
          }
          setUsers(Array.from(uniqueUsersMap.values()));
        }

        const labelsRes = await apiFetch(`/api/workspaces/${workspaceId}/labels`);
        if (labelsRes.ok) {
          setAvailableLabels(await labelsRes.json());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    loadBoard();
  }, [selectedWorkspaceId, reloadKey, setCurrentProject, setSelectedWorkspaceId]);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const projectId = currentProjectId;
    if (!projectId || !selectedWorkspaceId || !currentUserId || !currentUser) return;

    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

    const onConnect = () => {
      socket.emit("join:project", projectId);
      socket.emit("workspace:status", {
        workspaceId: selectedWorkspaceId,
        userId: currentUserId,
        userName: currentUser.name,
        userAvatarColor: currentUser.avatarColor,
        status: "online",
      });
    };
    socket.on("connect", onConnect);
    if (socket.connected) onConnect();

    socket.on("task:created", (newTask: Task & { projectId: string }) => {
      setTasks((prev) => {
        if (prev.some((t) => t.id === newTask.id)) return prev;
        return [...prev, newTask];
      });
      if (currentProjectId) loadAnalytics(currentProjectId);
      if (currentProjectId) loadActivityFeed(currentProjectId);
    });

    socket.on("task:updated", (updatedTask: Task & { projectId: string }) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
      );
      if (currentProjectId) loadAnalytics(currentProjectId);
      if (currentProjectId) loadActivityFeed(currentProjectId);
    });

    socket.on("task:deleted", (deletedTaskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== deletedTaskId));
      if (currentProjectId) loadAnalytics(currentProjectId);
      if (currentProjectId) loadActivityFeed(currentProjectId);
    });

    socket.on("presence:sync", (presenceMap: Record<string, string[]>) => {
      setPresence(presenceMap);
    });

    socket.on("fieldlock:sync", (lockMap: Record<string, { userId: string; userName: string; userAvatarColor: string }>) => {
      setFieldLocks(lockMap);
    });

    socket.on("workspace:presence", (list: typeof workspacePresence) => {
      setWorkspacePresence(list);
    });

    return () => {
      socket.off("connect", onConnect);
      if (socket.connected) socket.emit("leave:project", projectId);
      socket.disconnect();
    };
  }, [currentProjectId, selectedWorkspaceId, currentUserId, currentUser]);

  function emitPresence(taskId: string | null) {
    const projectId = currentProjectId;
    if (!projectId || !currentUserId || !socketRef.current) return;
    socketRef.current.emit("presence:set", { projectId, taskId, userId: currentUserId });
  }

  function emitFieldFocus(taskId: string, field: string) {
    const projectId = currentProjectId;
    if (!projectId || !currentUserId || !currentUser || !socketRef.current) return;
    socketRef.current.emit("field:focus", {
      projectId,
      taskId,
      field,
      userId: currentUserId,
      userName: currentUser.name,
      userAvatarColor: currentUser.avatarColor,
    });
  }

  function emitFieldBlur() {
    const projectId = currentProjectId;
    if (!projectId || !socketRef.current) return;
    socketRef.current.emit("field:blur", { projectId });
  }

  function emitWorkspaceStatus(status: "online" | "viewing" | "editing" | "away") {
    if (!selectedWorkspaceId || !currentUserId || !currentUser || !socketRef.current) return;
    socketRef.current.emit("workspace:status", {
      workspaceId: selectedWorkspaceId,
      userId: currentUserId,
      userName: currentUser.name,
      userAvatarColor: currentUser.avatarColor,
      status,
    });
  }

  function getFieldLockUser(taskId: string, field: string): User | null {
    const lock = fieldLocks[`${taskId}:${field}`];
    if (!lock || lock.userId === currentUserId) return null;
    return { id: lock.userId, name: lock.userName, avatarColor: lock.userAvatarColor, email: "" };
  }

  function getPresentUsers(taskId: string): User[] {
    const userIds = presence[taskId] ?? [];
    return userIds
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is User => u !== undefined);
  }

  const visibleTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [tasks, query]);

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  

  const analyticsChart = useMemo(() => {
    if (!analytics) return null;
    const total = analytics.byStatus.reduce((sum, item) => sum + item.count, 0);
    const colors = ["#6366f1", "#38bdf8", "#34d399", "#f59e0b", "#f97316"];
    let offset = 0;

    return {
      total,
      maxCreated: Math.max(...analytics.tasksCreatedLast7Days.map((item) => item.count), 1),
      wedges: analytics.byStatus.map((status, index) => {
        const portion = total > 0 ? (status.count / total) * 100 : 0;
        const start = offset;
        const end = offset + portion;
        offset = end;
        return {
          ...status,
          color: colors[index % colors.length],
          start,
          end,
        };
      }),
    };
  }, [analytics]);

  function totalPercent(value: number, total: number) {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    let destColumnId: string;
    let destIndex: number;

    const overColumn = columns.find((c) => c.id === overId);
    if (overColumn) {
      destColumnId = overColumn.id;
      destIndex = tasks.filter((t) => t.columnId === destColumnId).length;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      destColumnId = overTask.columnId;
      const destTasks = tasks
        .filter((t) => t.columnId === destColumnId)
        .sort((a, b) => a.position - b.position);
      destIndex = destTasks.findIndex((t) => t.id === overId);
    }

    if (activeTask.columnId === destColumnId) {
      const columnTasks = tasks
        .filter((t) => t.columnId === destColumnId)
        .sort((a, b) => a.position - b.position);
      const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
      if (oldIndex === destIndex) return;

      const reordered = arrayMove(columnTasks, oldIndex, destIndex).map((t, i) => ({
        ...t,
        position: i + 1,
      }));

      setTasks((prev) =>
        prev.map((t) => {
          const match = reordered.find((u) => u.id === t.id);
          return match ? { ...t, position: match.position } : t;
        })
      );

      const previousTasksSameColumn = tasks;
      persistColumnRenumber(
        destColumnId,
        reordered.map((t) => t.id),
        (message) => {
          setPermissionError(message);
          setTasks(previousTasksSameColumn);
        }
      );
      return;
    }

    const sourceRenumbered = tasks
      .filter((t) => t.columnId === activeTask.columnId && t.id !== activeId)
      .sort((a, b) => a.position - b.position)
      .map((t, i) => ({ ...t, position: i + 1 }));

    const destBefore = tasks
      .filter((t) => t.columnId === destColumnId)
      .sort((a, b) => a.position - b.position);

    const newDest = [...destBefore];
    newDest.splice(destIndex, 0, { ...activeTask, columnId: destColumnId });
    const destRenumbered = newDest.map((t, i) => ({ ...t, position: i + 1 }));

    setTasks((prev) => {
      const updates = new Map([
        ...sourceRenumbered.map((t) => [t.id, t] as const),
        ...destRenumbered.map((t) => [t.id, t] as const),
      ]);
      return prev.map((t) => updates.get(t.id) ?? t);
    });

    const previousTasksCrossColumn = tasks;
    const revertOnForbidden = (message: string) => {
      setPermissionError(message);
      setTasks(previousTasksCrossColumn);
    };

    if (sourceRenumbered.length > 0) {
      persistColumnRenumber(
        activeTask.columnId,
        sourceRenumbered.map((t) => t.id),
        revertOnForbidden
      );
    }
    persistColumnRenumber(
      destColumnId,
      destRenumbered.map((t) => t.id),
      revertOnForbidden
    );
  }

  async function handleAddTask(
    columnId: string,
    title: string,
    payload?: {
      assigneeId?: string | null;
      priority?: Task["priority"];
      dueDate?: string | null;
      dueDateLocked?: boolean;
    }
  ) {
    if (!currentProjectId) return;
    const projectId = currentProjectId;

    const newTask = await createTask(columnId, projectId, title, setPermissionError, payload);
    if (newTask) {
      setTasks((prev) => {
        if (prev.some((t) => t.id === newTask.id)) return prev;
        return [...prev, newTask];
      });
    }
  }

  async function handleCreateFirstProject() {
    if (!selectedWorkspaceId) return;
    setCreatingProject(true);
    try {
      const res = await apiFetch(`/api/workspaces/${selectedWorkspaceId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "General" }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Could not create project");
        return;
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      setError("Network error creating project");
    } finally {
      setCreatingProject(false);
    }
  }

  async function handleDeleteTask(taskId: string) {
    const success = await deleteTaskRequest(taskId, setPermissionError);
    if (success) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSelectedTaskId(null);
    }
  }

  

  async function handleUpdateTask(
    taskId: string,
    updates: Partial<{
      title: string;
      description: string | null;
      priority: Task["priority"];
      assigneeId: string | null;
      dueDate: string | null;
      dueDateLocked: boolean;
    }>
  ): Promise<boolean> {
    const currentVersion = tasks.find((t) => t.id === taskId)?.version;
    const updated = await updateTaskRequest(
      taskId,
      { ...updates, expectedVersion: currentVersion },
      (current) => setConflict({ taskTitle: current.title ?? "This task" }),
      setPermissionError
    );
    if (updated) {
      setConflict(null);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t))
      );
      return true;
    }
    return false;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <p className="text-ink-secondary text-sm">Loading board...</p>
      </div>
    );
  }

  if (error) {
      const isEmptyWorkspace = error === "No project found in this workspace";
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-paper gap-4">
          <p className="text-danger text-sm">Could not load the board: {error}</p>
          {isEmptyWorkspace && (
            <button
              type="button"
              onClick={handleCreateFirstProject}
              disabled={creatingProject}
              className="text-sm font-medium bg-indigo text-white rounded-md px-4 py-2 hover:opacity-90 transition disabled:opacity-50"
            >
              {creatingProject ? "Creating..." : "Create your first project"}
            </button>
          )}
        </div>
      );
    }

  return (
    <div className="min-h-screen flex bg-paper">
      <SideRail />
      <div className="flex-1 flex flex-col min-w-0">
        {conflict && (
          <div
            role="alert"
            className="mx-6 mt-4 px-4 py-3 rounded border border-warning bg-paper flex items-center justify-between gap-4"
          >
            <p className="text-sm text-ink">
              <span className="font-medium">&quot;{conflict.taskTitle}&quot;</span> was changed by
              someone else. Your changes were not saved.
            </p>
            <button
              onClick={() => setConflict(null)}
              className="text-xs text-ink-secondary hover:text-ink transition shrink-0"
              aria-label="Dismiss conflict"
            >
              Dismiss
            </button>
          </div>
        )}

        {permissionError && (
          <div
            role="alert"
            className="mx-6 mt-4 px-4 py-3 rounded border border-danger bg-paper flex items-center justify-between gap-4"
          >
            <p className="text-sm text-ink">{permissionError}</p>
            <button
              onClick={() => setPermissionError(null)}
              className="text-xs text-ink-secondary hover:text-ink transition shrink-0"
              aria-label="Dismiss permission error"
            >
              Dismiss
            </button>
          </div>
        )}

        <TopBar 
          users={users} 
          onlineUserIds={new Set(
            workspacePresence
              .filter((p: { userId: string; userName: string; userAvatarColor: string; status: "online" | "viewing" | "editing" | "away" }) => p.status !== "away")
              .map((p: { userId: string; userName: string; userAvatarColor: string; status: "online" | "viewing" | "editing" | "away" }) => p.userId)
          )} 
        />

        <main className="flex-1 px-6 py-6">
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-ink-secondary">Good {getGreeting()}, {currentUser?.name?.split(" ")[0] ?? "there"} 👋</p>
                <h1 className="font-display text-3xl font-semibold text-ink">Here&apos;s what&apos;s happening in your workspace today.</h1>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:pr-6">
                <div className="min-h-[124px] overflow-visible rounded-3xl border border-border bg-surface px-3 py-3 shadow-sm">
                  <div className="flex flex-col items-start gap-3">
                    <div className="flex w-full items-center gap-1.5">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 5h18" />
                          <path d="M3 12h18" />
                          <path d="M3 19h18" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-secondary">Tasks today</p>
                      </div>
                    </div>
                    <p className="ml-0.5 text-2xl font-display font-semibold leading-none text-ink sm:text-3xl">{analyticsLoading ? "—" : analytics?.tasksToday ?? 0}</p>
                  </div>
                </div>
                <div className="min-h-[124px] overflow-visible rounded-3xl border border-border bg-surface px-3 py-3 shadow-sm">
                  <div className="flex flex-col items-start gap-3">
                    <div className="flex w-full items-center gap-1.5">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16" />
                          <path d="M4 12h16" />
                          <path d="M4 20h16" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-secondary">In progress</p>
                      </div>
                    </div>
                    <p className="ml-0.5 text-[1.7rem] font-display font-semibold leading-none text-ink sm:text-[2rem]">{analyticsLoading ? "—" : analytics?.inProgressCount ?? 0}</p>
                  </div>
                </div>
                <div className="min-h-[124px] overflow-visible rounded-3xl border border-border bg-surface px-3 py-3 shadow-sm">
                  <div className="flex flex-col items-start gap-3">
                    <div className="flex w-full items-center gap-1.5">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 7l4-4 4 4" />
                          <path d="M4 21h16" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-secondary">Due today</p>
                      </div>
                    </div>
                    <p className="ml-0.5 text-2xl font-display font-semibold leading-none text-ink sm:text-3xl">{analyticsLoading ? "—" : analytics?.dueToday ?? 0}</p>
                  </div>
                </div>
                <div className="min-h-[124px] overflow-visible rounded-3xl border border-border bg-surface px-3 py-3 shadow-sm">
                  <div className="flex flex-col items-start gap-3">
                    <div className="flex w-full items-center gap-1.5">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-secondary">Done rate</p>
                      </div>
                    </div>
                    <p className="ml-0.5 text-2xl font-display font-semibold leading-none text-ink sm:text-3xl">{analyticsLoading ? "—" : `${analytics?.progressPercent ?? 0}%`}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="flex gap-6 min-h-0 overflow-x-auto pb-4 px-1">
                  {[...columns]
                    .sort((a, b) => a.position - b.position)
                    .map((column) => {
                      const columnTasks = visibleTasks
                        .filter((t) => t.columnId === column.id)
                        .sort((a, b) => a.position - b.position);

                      return (
                        <BoardColumn
                          key={column.id}
                          column={column}
                          tasks={columnTasks}
                          presentUsers={presence}
                          users={users}
                          isDrawerOpen={!!selectedTaskId}
                          onTaskClick={(taskId: string) => {
                            setSelectedTaskId(taskId);
                            emitPresence(taskId);
                            emitWorkspaceStatus("viewing");
                          }}
                          onAddTask={handleAddTask}
                        />
                      );
                    })}
                </div>

                <DragOverlay>
                  {activeTask ? (
                    <TaskCard
                      task={activeTask}
                      assignee={users.find((u) => u.id === activeTask.assigneeId)}
                      presentUsers={getPresentUsers(activeTask.id)}
                      onClick={() => { }}
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>

            <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr_0.9fr]">
              <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-secondary">Project health</p>
                    <p className="mt-1 text-sm text-ink-secondary">Live task distribution and progress.</p>
                  </div>
                  <span className="rounded-full bg-indigo/10 px-3 py-1 text-xs font-semibold text-indigo">{analytics?.scope === "workspace" ? "Workspace" : "My tasks"}</span>
                </div>
                {analyticsLoading ? (
                  <div className="h-72 rounded-3xl bg-border/70 animate-pulse" />
                ) : analyticsError ? (
                  <p className="text-sm text-danger">{analyticsError}</p>
                ) : analytics && analyticsChart ? (
                  <div className="grid gap-6 xl:grid-cols-[0.9fr_1fr] items-center">
                    <div className="rounded-3xl border border-border bg-paper p-5 flex flex-col items-center justify-center gap-4">
                      <div
                        className="relative h-56 w-56 rounded-full"
                        style={{
                          background: `conic-gradient(${analyticsChart.wedges
                            .map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`)
                            .join(", ")})`,
                        }}
                      >
                        <div className="absolute inset-1/4 rounded-full bg-surface shadow-inner" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs uppercase tracking-[0.2em] text-ink-secondary">Done rate</p>
                        <p className="mt-2 text-3xl font-display font-semibold text-ink">{analytics.progressPercent}%</p>
                        <p className="text-sm text-ink-secondary">of tasks complete</p>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {analyticsChart.wedges.map((segment) => (
                        <div key={segment.columnId} className="rounded-3xl border border-border bg-paper p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span
                              className="inline-flex h-3 w-3 rounded-full"
                              style={{ backgroundColor: segment.color }}
                            />
                            <div>
                              <p className="text-sm font-semibold text-ink">{segment.columnName}</p>
                              <p className="text-xs text-ink-secondary">{segment.count} tasks</p>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-ink">{totalPercent(segment.count, analyticsChart.total)}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-ink-secondary">No analytics data yet.</p>
                )}
              </div>

              <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-secondary">Recent activity</p>
                    <p className="mt-1 text-sm text-ink-secondary">Latest project updates in one feed.</p>
                  </div>
                  <span className="text-xs font-semibold text-ink-secondary">{activityFeed.length} items</span>
                </div>
                {activityLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, idx) => (
                      <div key={idx} className="h-16 rounded-3xl bg-border/70 animate-pulse" />
                    ))}
                  </div>
                ) : activityError ? (
                  <p className="text-sm text-danger">{activityError}</p>
                ) : activityFeed.length === 0 ? (
                  <p className="text-sm text-ink-secondary">No recent updates yet.</p>
                ) : (
                  <div className="space-y-4">
                    {activityFeed.map((item) => (
                      <div key={item.id} className="rounded-3xl border border-border bg-paper p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                            style={{ backgroundColor: item.user?.avatarColor ?? "#94a3b8" }}
                          >
                            {item.user?.name?.charAt(0) ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">{item.user?.name ?? "Someone"}</p>
                            <p className="text-xs text-ink-secondary">{formatTimestamp(item.createdAt)}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-ink-secondary">
                          {formatActivityMessage(item.action as ActivityAction, item.metadata)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <aside className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-secondary">Upcoming deadlines</p>
                  <p className="mt-1 text-sm text-ink-secondary">Tasks due soon across the project.</p>
                  <div className="mt-5 space-y-4">
                    {analyticsLoading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, idx) => (
                          <div key={idx} className="h-16 rounded-3xl bg-border/70 animate-pulse" />
                        ))}
                      </div>
                    ) : analyticsError ? (
                      <p className="text-sm text-danger">{analyticsError}</p>
                    ) : analytics && analytics.upcomingDeadlines.length === 0 ? (
                      <p className="text-sm text-ink-secondary">No upcoming deadlines.</p>
                    ) : (
                      analytics?.upcomingDeadlines.map((task) => (
                        <div key={task.id} className="rounded-3xl border border-border bg-paper p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink truncate">{task.title}</p>
                              <p className="text-[11px] text-ink-secondary mt-1">Due {formatShortDate(task.dueDate)}</p>
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo">{task.priority}</span>
                          </div>
                          <div className="mt-3 flex items-center gap-3 text-xs text-ink-secondary">
                            <span>{task.assignee?.name ?? "Unassigned"}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </aside>
            </section>
          </div>
        </main>

        <TaskDrawer
          task={selectedTask}
          users={users}
          presentUsers={selectedTask ? getPresentUsers(selectedTask.id) : []}
          onClose={() => {
            setSelectedTaskId(null);
            emitPresence(null);
            emitFieldBlur();
            emitWorkspaceStatus("online");
          }}
          onDelete={handleDeleteTask}
          onUpdate={handleUpdateTask}
          titleLockedBy={selectedTask ? getFieldLockUser(selectedTask.id, "title") : null}
          descriptionLockedBy={selectedTask ? getFieldLockUser(selectedTask.id, "description") : null}
          onFieldFocus={(field) => {
            if (selectedTask) emitFieldFocus(selectedTask.id, field);
            emitWorkspaceStatus("editing");
          }}
          onFieldBlur={() => {
            emitFieldBlur();
            emitWorkspaceStatus("viewing");
          }}
        />

                <PresenceBar
          entries={Object.values(workspacePresence).map((p) => {
            const u = users.find((user) => user.id === p.userId);
            return {
              userId: p.userId,
              userName: u?.name || "Unknown",
              userAvatarColor: u?.avatarColor || "#CCC",
              status: p.status,
            };
          })}
          showActivityLine
          currentProjectId={currentProjectId}
        />
      </div>
    </div>
  );
}
