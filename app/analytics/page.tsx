"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import SideRail from "@/components/SideRail";
import TopBar from "@/components/TopBar";
import { apiFetch } from "@/lib/api-client";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { io, Socket } from "socket.io-client";
import { User } from "@/lib/mock-data";

type AnalyticsResponse = {
  scope: "workspace" | "mine";
  totalTasks: number;
  byStatus: { columnId: string; columnName: string; count: number }[];
  byPriority: Record<string, number>;
  avgTimeToDoneHours: number | null;
  tasksCreatedLast7Days: { date: string; count: number }[];
  tasksCreatedPrevious7Days: { date: string; count: number }[];
  tasksToday: number;
  inProgressCount: number;
  dueToday: number;
  progressPercent: number;
};

type PresenceEntry = {
  userId: string;
  userName: string;
  userAvatarColor: string;
  status: "online" | "viewing" | "editing" | "away";
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-400",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-violet-600",
  URGENT: "bg-rose-600",
};

function formatShortDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildSparklinePath(values: number[], width: number, height: number) {
  if (!values.length) return "";
  const maxValue = Math.max(1, ...values);
  const innerWidth = width - 8;
  const innerHeight = height - 8;
  const step = values.length > 1 ? innerWidth / (values.length - 1) : innerWidth / 2;
  const points = values.map((value, index) => {
    const x = index * step + 4;
    const normalized = value / maxValue;
    const y = height - 4 - normalized * innerHeight;
    return { x, y };
  });

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x.toFixed(2)} ${height - 4} L ${first.x.toFixed(2)} ${height - 4} Z`;
}

function DonutChart({ segments }: { segments: { label: string; count: number; color: string }[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-44 w-44">
          <svg viewBox="0 0 140 140" className="h-44 w-44 -rotate-90">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="24" />
            {total === 0 ? (
              <circle cx="70" cy="70" r={radius} fill="none" stroke="#cbd5e1" strokeWidth="24" strokeDasharray={`${circumference}`} strokeDashoffset="0" />
            ) : (
              segments.map((segment) => {
                const fraction = segment.count / total;
                const dash = fraction * circumference;
                const strokeDasharray = `${dash} ${circumference - dash}`;
                const strokeDashoffset = -offset;
                offset += dash;
                return (
                  <circle
                    key={segment.label}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="24"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                  />
                );
              })
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-ink-secondary">Total</p>
            <p className="mt-1 text-3xl font-display font-semibold text-ink">{total}</p>
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="grid gap-3 sm:grid-cols-2">
          {segments.map((segment) => {
            const percent = total === 0 ? 0 : Math.round((segment.count / total) * 100);
            return (
              <div key={segment.label} className="rounded-2xl border border-border bg-paper px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                    <span className="text-sm font-semibold text-ink">{segment.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-ink">{segment.count}</span>
                </div>
                <p className="mt-2 text-xs text-ink-secondary">{percent}% of tasks</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const setSelectedWorkspaceId = useWorkspaceStore((s) => s.setSelectedWorkspaceId);
  const currentProject = useWorkspaceStore((s) => s.currentProject);
  const setCurrentProject = useWorkspaceStore((s) => s.setCurrentProject);

  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>([]);
  const [workspacePresence, setWorkspacePresence] = useState<PresenceEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatarColor: string } | null>(null);
  const [scopeFilter, setScopeFilter] = useState<"workspace" | "mine">("workspace");

  const loadAnalytics = useCallback(
    async (projectId: string, scope: "workspace" | "mine" = scopeFilter) => {
      try {
        setError(null);
        const res = await apiFetch(
          `/api/dashboard/analytics?projectId=${projectId}&scope=${encodeURIComponent(scope)}`
        );
        if (!res.ok) throw new Error("Could not load analytics");
        const analytics = await res.json();
        setData(analytics);
        setScopeFilter(analytics.scope);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [scopeFilter]
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveProject() {
      setLoading(true);
      try {
        const workspaceId = selectedWorkspaceId;
        if (!workspaceId) {
          const wsRes = await apiFetch("/api/workspaces");
          if (!wsRes.ok) throw new Error("Could not load workspaces");
          const workspaces = await wsRes.json();
          if (!workspaces.length) throw new Error("No workspace found for this user");
          setSelectedWorkspaceId(workspaces[0].id);
          return;
        }

        if (currentProject?.id) {
          if (!cancelled) await loadAnalytics(currentProject.id);
          return;
        }

        const projRes = await apiFetch(`/api/workspaces/${workspaceId}/projects`);
        if (!projRes.ok) throw new Error("Could not load projects");
        const projects = await projRes.json();
        if (!projects.length) throw new Error("No project found in this workspace");

        const projectId = projects[0].id;
        setCurrentProject({ id: projectId, name: projects[0].name });
        if (!cancelled) await loadAnalytics(projectId);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong");
          setLoading(false);
        }
      }
    }

    resolveProject();
    return () => {
      cancelled = true;
    };
  }, [selectedWorkspaceId, currentProject?.id, setCurrentProject, setSelectedWorkspaceId, loadAnalytics]);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const res = await apiFetch("/api/auth/me");
        if (!res.ok) return;
        const me = await res.json();
        if (!cancelled) {
          setCurrentUserId(me.id);
          setCurrentUser({ id: me.id, name: me.name, avatarColor: me.avatarColor });
        }
      } catch {
        // Ignore auth bootstrap failures here; this page can still render without live presence.
      }
    }

    loadCurrentUser();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function loadWorkspaceUsers() {
      if (!selectedWorkspaceId) {
        setWorkspaceUsers([]);
        return;
      }

      try {
        const res = await apiFetch(`/api/workspaces/${selectedWorkspaceId}/members`);
        if (!res.ok) {
          setWorkspaceUsers([]);
          return;
        }

        const body = await res.json();
        setWorkspaceUsers(
          (body.members ?? []).map((member: { id: string; name: string; email: string; avatarColor: string }) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            avatarColor: member.avatarColor,
          }))
        );
      } catch {
        setWorkspaceUsers([]);
      }
    }

    loadWorkspaceUsers();
  }, [selectedWorkspaceId]);

  useEffect(() => {
    if (!selectedWorkspaceId || !currentUserId || !currentUser) return;

    const socket: Socket = io({ path: "/socket.io" });
    const onConnect = () => {
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
    socket.on("workspace:presence", (list: PresenceEntry[]) => {
      setWorkspacePresence(list);
    });

    return () => {
      socket.off("connect", onConnect);
      socket.disconnect();
    };
  }, [selectedWorkspaceId, currentUserId, currentUser]);

  useEffect(() => {
    if (!currentProject?.id) return;

    const socket: Socket = io({ path: "/socket.io" });
    socket.emit("join:project", currentProject.id);
    socket.on("task:created", () => loadAnalytics(currentProject.id, scopeFilter));
    socket.on("task:updated", () => loadAnalytics(currentProject.id, scopeFilter));
    socket.on("task:deleted", () => loadAnalytics(currentProject.id, scopeFilter));

    return () => {
      socket.disconnect();
    };
  }, [currentProject?.id, scopeFilter, loadAnalytics]);

  const onlineUserIds = useMemo(
    () => new Set(workspacePresence.filter((presence) => presence.status !== "away").map((presence) => presence.userId)),
    [workspacePresence]
  );

  const created7DaysTotal = data?.tasksCreatedLast7Days.reduce((sum, entry) => sum + entry.count, 0) ?? 0;
  const previous7DaysTotal = data?.tasksCreatedPrevious7Days.reduce((sum, entry) => sum + entry.count, 0) ?? 0;
  const createdChangePercent = previous7DaysTotal === 0
    ? (created7DaysTotal > 0 ? 100 : 0)
    : Math.round(((created7DaysTotal - previous7DaysTotal) / previous7DaysTotal) * 100);

  const statusSegments = useMemo(() => {
    if (!data) return [];
    return data.byStatus.map((status) => ({
      label: status.columnName,
      count: status.count,
      color: status.columnName.toLowerCase().includes("done")
        ? "#10b981"
        : status.columnName.toLowerCase().includes("progress")
          ? "#6366f1"
          : status.columnName.toLowerCase().includes("review")
            ? "#8b5cf6"
            : status.columnName.toLowerCase().includes("blocked")
              ? "#ef4444"
              : "#94a3b8",
    }));
  }, [data]);

  const priorityEntries = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byPriority).map(([priority, count]) => ({
      priority,
      count,
      percent: data.totalTasks === 0 ? 0 : Math.round((count / data.totalTasks) * 100),
    }));
  }, [data]);

  const linePoints = useMemo(() => {
    if (!data?.tasksCreatedLast7Days.length) return [];
    const values = data.tasksCreatedLast7Days.map((entry) => entry.count);
    const maxValue = Math.max(1, ...values);
    const width = 280;
    const height = 120;
    const innerWidth = width - 8;
    const innerHeight = height - 8;
    const step = values.length > 1 ? innerWidth / (values.length - 1) : innerWidth / 2;

    return values.map((value, index) => {
      const x = index * step + 4;
      const normalized = value / maxValue;
      const y = height - 4 - normalized * innerHeight;
      return { x, y };
    });
  }, [data]);

  const linePath = useMemo(() => {
    if (!linePoints.length) return "";
    return linePoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
  }, [linePoints]);

  const areaPath = useMemo(() => {
    if (!linePoints.length) return "";
    const path = linePoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
    return `${path} L ${linePoints[linePoints.length - 1].x.toFixed(2)} 132 L ${linePoints[0].x.toFixed(2)} 132 Z`;
  }, [linePoints]);

  return (
    <div className="min-h-screen flex bg-paper">
      <SideRail />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar users={workspaceUsers} onlineUserIds={onlineUserIds} />

        <main className="flex-1 px-6 py-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            <div className="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3v18h18" />
                      <path d="M7 15l3-4 3 2 4-6" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="font-display text-3xl font-semibold text-ink">Analytics</h1>
                    <p className="mt-1 text-sm text-ink-secondary">Track productivity, task progress, and team performance.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {data ? (
                  <select
                    value={scopeFilter}
                    onChange={async (e) => {
                      const selected = e.target.value as "workspace" | "mine";
                      setScopeFilter(selected);
                      if (currentProject?.id) {
                        setLoading(true);
                        await loadAnalytics(currentProject.id, selected);
                      }
                    }}
                    className="rounded-full border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-secondary outline-none transition focus:border-indigo"
                    aria-label="Analytics scope"
                  >
                    <option value="workspace">Whole workspace</option>
                    <option value="mine">My tasks only</option>
                  </select>
                ) : null}
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-ink-secondary">Loading analytics...</p>
            ) : error ? (
              <p className="text-sm font-medium text-danger">{error}</p>
            ) : data ? (
              <>
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 3v18" />
                            <path d="M17 8v13" />
                            <path d="M12 13v8" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-secondary">Total tasks</p>
                          <p className="mt-1 text-2xl font-display font-semibold text-ink">{data.totalTasks}</p>
                        </div>
                      </div>
                      <svg viewBox="0 0 120 40" className="h-10 w-24 shrink-0">
                        <path d={buildSparklinePath(data.tasksCreatedLast7Days.map((entry) => entry.count), 96, 36)} fill="rgba(99, 102, 241, 0.16)" stroke="rgba(99, 102, 241, 0.85)" strokeWidth="2" />
                      </svg>
                    </div>
                    <p className="mt-3 text-sm text-ink-secondary">Across workspace</p>
                  </div>

                  <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="8" />
                            <path d="M12 7v5l3 2" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-secondary">Avg time to done</p>
                          <p className="mt-1 text-2xl font-display font-semibold text-ink">
                            {data.avgTimeToDoneHours === null ? "—" : `${data.avgTimeToDoneHours.toFixed(1)}h`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-ink-secondary">
                      {data.avgTimeToDoneHours === null ? "No completed tasks yet" : `${data.avgTimeToDoneHours.toFixed(1)}h average completion`}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="5" width="16" height="15" rx="2" />
                            <path d="M8 3v4" />
                            <path d="M16 3v4" />
                            <path d="M8 11h8" />
                            <path d="M8 15h5" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-secondary">Created 7D</p>
                          <p className="mt-1 text-2xl font-display font-semibold text-ink">{created7DaysTotal}</p>
                        </div>
                      </div>
                      <svg viewBox="0 0 120 40" className="h-10 w-24 shrink-0">
                        <path d={buildSparklinePath(data.tasksCreatedLast7Days.map((entry) => entry.count), 96, 36)} fill="rgba(245, 158, 11, 0.18)" stroke="rgba(245, 158, 11, 0.9)" strokeWidth="2" />
                      </svg>
                    </div>
                    <p className="mt-3 text-sm text-ink-secondary">{`${createdChangePercent >= 0 ? "+" : ""}${createdChangePercent}% vs last 7 days`}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-ink">Tasks by column</h2>
                      <p className="mt-1 text-sm text-ink-secondary">Live distribution across the workspace columns.</p>
                    </div>
                    <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-paper text-ink-secondary" aria-label="Export analytics summary">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v12" />
                        <path d="M8 7l4 4 4-4" />
                        <path d="M5 20h14" />
                      </svg>
                    </button>
                  </div>
                  <DonutChart segments={statusSegments} />
                </div>

                <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-ink">Tasks by priority</h2>
                      <p className="mt-1 text-sm text-ink-secondary">Priority mix scaled to the current workspace totals.</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {priorityEntries.map((entry) => (
                      <div key={entry.priority} className="rounded-2xl border border-border bg-paper p-4">
                        <div className="flex items-center gap-2">
                          <span className={`h-3 w-3 rounded-full ${PRIORITY_COLORS[entry.priority]}`} />
                          <span className="text-sm font-semibold text-ink">{entry.priority}</span>
                        </div>
                        <p className="mt-3 text-2xl font-display font-semibold text-ink">{entry.count}</p>
                        <p className="mt-1 text-sm text-ink-secondary">{entry.percent}% of tasks</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-border/70">
                    {priorityEntries.map((entry) => (
                      <div key={entry.priority} className={`h-full ${PRIORITY_COLORS[entry.priority]}`} style={{ width: `${entry.percent}%` }} />
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-ink">Created — last 7 days</h2>
                      <p className="mt-1 text-sm text-ink-secondary">Daily task creation trend from the latest workspace activity.</p>
                    </div>
                    <select className="rounded-lg border border-border bg-paper px-3 py-2 text-sm text-ink-secondary" defaultValue="7d">
                      <option value="7d">Last 7 days</option>
                    </select>
                  </div>
                  <div className="rounded-3xl border border-border bg-paper p-4">
                    <svg viewBox="0 0 320 140" className="h-48 w-full">
                      <path d="M 4 132 L 4 20 L 316 20 L 316 132" fill="none" />
                      {linePoints.length > 0 ? (
                        <>
                          <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="3" />
                          <path d={areaPath} fill="rgba(99, 102, 241, 0.16)" />
                        </>
                      ) : null}
                    </svg>
                    <div className="mt-3 grid grid-cols-7 gap-2">
                      {data.tasksCreatedLast7Days.map((entry) => (
                        <div key={entry.date} className="text-center">
                          <p className="text-[11px] text-ink-secondary">{formatShortDate(entry.date)}</p>
                          <p className="mt-1 text-sm font-semibold text-ink">{entry.count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
