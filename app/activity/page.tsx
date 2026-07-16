"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SideRail from "@/components/SideRail";
import TopBar from "@/components/TopBar";
import { apiFetch } from "@/lib/api-client";
import { ActivityAction, User } from "@/lib/mock-data";
import { formatActivityMessage, formatTimestamp } from "@/lib/activity-format";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { io, Socket } from "socket.io-client";

type ActivityUser = { id: string; name: string; avatarColor: string };

type ApiActivity = {
  id: string;
  taskId: string | null;
  projectId: string;
  userId: string;
  action: ActivityAction;
  metadata: Record<string, string> | null;
  createdAt: string;
  user: ActivityUser | null;
};

const PAGE_SIZE = 8;

function getTransitionBadgeStyles(destinationStatus: string) {
  const status = destinationStatus.toLowerCase();

  switch (status) {
    case "in progress":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "to do":
    case "todo":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "done":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "review":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "blocked":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export default function ActivityPage() {
  const [filter, setFilter] = useState<"all" | ActivityAction>("all");
  const [activities, setActivities] = useState<ApiActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showMovedOnly, setShowMovedOnly] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const currentProject = useWorkspaceStore((s) => s.currentProject);
  const [reloadKey, setReloadKey] = useState(0);
  const [creatingProject, setCreatingProject] = useState(false);
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>([]);
  const [workspacePresence, setWorkspacePresence] = useState<
    { userId: string; userName: string; userAvatarColor: string; status: "online" | "viewing" | "editing" | "away" }[]
  >([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatarColor: string } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const resetKey = `${currentProject?.id ?? ""}:${selectedWorkspaceId ?? ""}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPage(1);
  }

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
        // Ignore auth bootstrap failures here; the page can still render without live presence.
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

        const data = await res.json();
        setWorkspaceUsers(
          (data.members ?? []).map((member: { id: string; name: string; email: string; avatarColor: string }) => ({
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

    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

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

    socket.on("workspace:presence", (list: typeof workspacePresence) => {
      setWorkspacePresence(list);
    });

    return () => {
      socket.off("connect", onConnect);
      socket.disconnect();
    };
  }, [selectedWorkspaceId, currentUserId, currentUser]);

  useEffect(() => {
    async function loadActivity() {
      try {
        setLoading(true);
        setError(null);

        let projectId = currentProject?.id;

        if (!projectId) {
          const wsRes = await apiFetch("/api/workspaces");
          if (!wsRes.ok) throw new Error("Could not load workspaces");
          const workspaces = await wsRes.json();
          if (!workspaces.length) throw new Error("No workspace found for this user");

          const workspaceId = selectedWorkspaceId ?? workspaces[0].id;
          const projRes = await apiFetch(`/api/workspaces/${workspaceId}/projects`);
          if (!projRes.ok) throw new Error("Could not load projects");
          const projects = await projRes.json();
          if (!projects.length) throw new Error("No project found in this workspace");

          projectId = projects[0].id;
        }

        const actRes = await apiFetch(`/api/projects/${projectId}/activity?page=${page}&limit=${PAGE_SIZE}`);
        if (!actRes.ok) throw new Error("Could not load activity");
        const data = await actRes.json();
        setActivities(data.activities ?? []);
        setTotalPages(data.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    loadActivity();
  }, [currentProject?.id, page, reloadKey, selectedWorkspaceId]);

  const filtered = useMemo(() => {
    let next = activities;

    if (filter !== "all") {
      next = next.filter((a) => a.action === filter);
    }

    if (showMovedOnly) {
      next = next.filter((a) => a.action === "task.moved");
    }

    return [...next].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [activities, filter, showMovedOnly]);

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
    } catch {
      setError("Network error creating project");
    } finally {
      setCreatingProject(false);
    }
  }

  function renderPageNumbers() {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);

    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }

    return pages;
  }

  const onlineUserIds = useMemo(
    () =>
      new Set(
        workspacePresence
          .filter((presence) => presence.status !== "away")
          .map((presence) => presence.userId)
      ),
    [workspacePresence]
  );

  return (
    <div className="min-h-screen flex bg-paper">
      <SideRail />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar users={workspaceUsers} onlineUserIds={onlineUserIds} />

        <main className="flex-1 px-6 py-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16" />
                      <path d="M4 20h16" />
                      <path d="M7 7h10" />
                      <path d="M7 17h10" />
                    </svg>
                  </div>
                  <h1 className="font-display text-2xl font-semibold text-ink">Activity</h1>
                </div>
                <p className="mt-2 text-sm text-ink-secondary">
                  Stay updated with the latest changes and actions across your workspace.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowFilterMenu((value) => !value)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-ink-secondary transition hover:bg-surface-sunken"
                    aria-label="Open filters"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 5h16" />
                      <path d="M7 12h10" />
                      <path d="M10 19h4" />
                    </svg>
                  </button>

                  {showFilterMenu ? (
                    <div className="absolute right-0 top-full z-10 mt-2 w-44 rounded-xl border border-border bg-surface p-2 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMovedOnly((value) => !value);
                          setShowFilterMenu(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                          showMovedOnly ? "bg-indigo-50 text-indigo-700" : "text-ink-secondary hover:bg-surface-sunken"
                        }`}
                      >
                        <span>Only moved</span>
                        {showMovedOnly ? <span className="text-xs">✓</span> : null}
                      </button>
                    </div>
                  ) : null}
                </div>

                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-indigo"
                >
                  <option value="all">All activity</option>
                  <option value="task.created">Created</option>
                  <option value="task.updated">Updated</option>
                  <option value="task.moved">Moved</option>
                  <option value="task.assigned">Assigned</option>
                  <option value="task.deleted">Deleted</option>
                </select>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
              {loading ? (
                <p className="p-6 text-sm text-ink-secondary">Loading activity...</p>
              ) : error ? (
                <div className="flex flex-col gap-3 p-6">
                  <p className="text-sm text-danger">Could not load activity: {error}</p>
                  {error === "No project found in this workspace" ? (
                    <button
                      type="button"
                      onClick={handleCreateFirstProject}
                      disabled={creatingProject}
                      className="self-start rounded-lg bg-indigo px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {creatingProject ? "Creating…" : "Create your first project"}
                    </button>
                  ) : null}
                </div>
              ) : filtered.length === 0 ? (
                <p className="p-6 text-sm text-ink-secondary">No activity yet.</p>
              ) : (
                <>
                  {filtered.map((a) => {
                    const user = a.user;
                    const isMoved = a.action === "task.moved";
                    const fromStatus = a.metadata?.from ?? "Unknown";
                    const toStatus = a.metadata?.to ?? "Unknown";
                    const pillStyles = getTransitionBadgeStyles(toStatus);

                    return (
                      <div
                        key={a.id}
                        className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 last:border-b-0"
                      >
                        <div className="flex min-w-0 flex-1 gap-3">
                          {user ? (
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                              style={{ backgroundColor: user.avatarColor }}
                            >
                              {user.name.charAt(0)}
                            </div>
                          ) : (
                            <div className="h-9 w-9 shrink-0 rounded-full bg-border" />
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-6">
                              <span className="font-medium text-ink">{user?.name ?? "Someone"}</span>{" "}
                              <span className="text-ink-secondary">{formatActivityMessage(a.action, a.metadata)}</span>
                            </p>
                            <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-secondary">
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="8" />
                                <path d="M12 7v5l3 2" />
                              </svg>
                              {formatTimestamp(a.createdAt)}
                            </span>
                          </div>
                        </div>

                        {isMoved ? (
                          <div className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${pillStyles}`}>
                            {fromStatus} → {toStatus}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  {totalPages > 1 ? (
                    <div className="flex items-center justify-center gap-2 border-t border-border px-4 py-4">
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page === 1}
                        className="rounded-lg border border-border px-3 py-2 text-sm text-ink-secondary transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ←
                      </button>

                      {renderPageNumbers().map((pageNumber) => (
                        <button
                          key={pageNumber}
                          type="button"
                          onClick={() => setPage(pageNumber)}
                          className={`min-w-9 rounded-lg border px-3 py-2 text-sm transition ${
                            pageNumber === page
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border-border text-ink-secondary hover:bg-surface-sunken"
                          }`}
                        >
                          {pageNumber}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={page === totalPages}
                        className="rounded-lg border border-border px-3 py-2 text-sm text-ink-secondary transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        →
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
