"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "@/lib/mock-data";
import NotificationsBell from "@/components/NotificationsBell";
import ExportButton from "@/components/ExportButton";
import ThemeToggle from "@/components/ThemeToggle";
import { apiFetch } from "@/lib/api-client";
import { useSearchStore } from "@/lib/searchStore";
import { useWorkspaceStore } from "@/lib/workspaceStore";

type Workspace = { id: string; name: string; ownerId: string; memberCount: number };

type TopBarProps = {
  users?: User[];
  onlineUserIds?: Set<string>;
};

export default function TopBar({ users = [], onlineUserIds = new Set() }: TopBarProps) {
  const router = useRouter();
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const currentProject = useWorkspaceStore((s) => s.currentProject);
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const setSelectedWorkspaceId = useWorkspaceStore((s) => s.setSelectedWorkspaceId);
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);
  const setCurrentProject = useWorkspaceStore((s) => s.setCurrentProject);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaces() {
      try {
        setLoadingWorkspaces(true);
        setWorkspaceError(null);
        const res = await apiFetch("/api/workspaces");
        if (!res.ok) throw new Error("Could not load workspaces");
        const data: Workspace[] = await res.json();
        if (cancelled) return;
        setWorkspaces(data);
      } catch (err) {
        if (!cancelled) setWorkspaceError(err instanceof Error ? err.message : "Could not load workspaces");
      } finally {
        if (!cancelled) setLoadingWorkspaces(false);
      }
    }

    loadWorkspaces();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (currentWorkspace || workspaces.length === 0) return;
    const active = selectedWorkspaceId
      ? workspaces.find((ws) => ws.id === selectedWorkspaceId)
      : workspaces[0];

    if (active) {
      setSelectedWorkspaceId(active.id);
      setCurrentWorkspace({ id: active.id, name: active.name });
    }
  }, [currentWorkspace, selectedWorkspaceId, workspaces, setCurrentWorkspace, setSelectedWorkspaceId]);

  function handleWorkspaceSwitch(workspace: Workspace) {
    setSelectedWorkspaceId(workspace.id);
    setCurrentWorkspace({ id: workspace.id, name: workspace.name });
    setCurrentProject(null);
    setWorkspaceMenuOpen(false);
    router.refresh();
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout request failed:", error);
    }
    window.location.href = "/login";
  }

  const workspaceLabel = currentWorkspace?.name ?? "Select workspace";

  const workspaceBadgeColor = useMemo(() => {
    const colors = ["#60A5FA", "#A78BFA", "#F59E0B", "#34D399", "#F87171"];
    const name = currentWorkspace?.name ?? "Workspace";
    const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }, [currentWorkspace?.name]);

  const onlineCount = onlineUserIds ? onlineUserIds.size : 0;

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-1 border-b border-border bg-surface-sunken text-xs">
        <div className="flex items-center gap-3">
          <span className="text-ink-secondary">Workspace:</span>
          <span className="font-medium">{currentWorkspace?.name ?? '—'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-ink-secondary">Live:</span>
          <span className="font-medium text-status-live">{onlineCount}</span>
        </div>
      </div>

      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:border-ink hover:bg-white"
          >
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-2xl font-semibold text-white"
              style={{ backgroundColor: workspaceBadgeColor }}
            >
              {currentWorkspace?.name?.charAt(0) ?? "W"}
            </span>
            <span>{workspaceLabel}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {workspaceMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl border border-border bg-surface shadow-lg z-20 overflow-hidden">
              <div className="max-h-72 overflow-auto">
                {loadingWorkspaces ? (
                  <div className="p-4 text-sm text-ink-secondary">Loading workspaces...</div>
                ) : workspaceError ? (
                  <div className="p-4 text-sm text-danger">{workspaceError}</div>
                ) : workspaces.length === 0 ? (
                  <div className="p-4 text-sm text-ink-secondary">No workspaces found.</div>
                ) : (
                  workspaces.map((workspace) => {
                    const isActive = workspace.id === currentWorkspace?.id;
                    return (
                      <button
                        key={workspace.id}
                        type="button"
                        onClick={() => handleWorkspaceSwitch(workspace)}
                        className={`w-full text-left px-4 py-3 text-sm transition ${
                          isActive ? "bg-indigo/10 text-ink" : "text-ink-secondary hover:bg-paper/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-8 w-8 items-center justify-center rounded-2xl font-semibold text-white"
                              style={{ backgroundColor: (() => {
                                const colors = ["#60A5FA", "#A78BFA", "#F59E0B", "#34D399", "#F87171"];
                                const hash = Array.from(workspace.name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
                                return colors[hash % colors.length];
                              })() }}
                            >
                              {workspace.name.charAt(0)}
                            </span>
                            <span>{workspace.name}</span>
                          </div>
                          {isActive && <span className="text-[11px] text-indigo font-semibold">Current</span>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col text-sm leading-5">
          <span className="font-display text-lg font-semibold text-ink">{currentWorkspace?.name ?? "Ledger"}</span>
          {currentProject && <span className="text-ink-secondary">{currentProject.name}</span>}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 w-64 text-sm border border-border rounded-xl px-3 py-2 bg-paper focus-within:ring-2 focus-within:ring-indigo overflow-hidden">
        <span aria-hidden="true" className="text-ink-secondary text-xs shrink-0">Q</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks..."
          className="flex-1 min-w-0 bg-transparent focus:outline-none"
        />
        <kbd className="text-[10px] text-ink-secondary/60 border border-border rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">Ctrl+K</kbd>
      </div>

      <div className="flex items-center gap-4">
        <NotificationsBell />
        <ExportButton />
        <ThemeToggle />

        <div className="hidden sm:flex items-center">
          {users.slice(0, 5).map((user, index) => (
            <div key={user.id} className={`relative ${index > 0 ? "-ml-3" : ""} ${index === users.slice(0, 5).length - 1 ? "z-20" : "z-10"}`}>
              <div
                title={user.name}
                className="w-9 h-9 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: user.avatarColor }}
              >
                {user.name.charAt(0)}
              </div>
              {onlineUserIds.has(user.id) && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-500" />
              )}
            </div>
          ))}
          {users.length > 5 && (
            <div className="-ml-3 inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-full border-2 border-white bg-paper text-[11px] text-ink-secondary shadow-sm">
              +{users.length - 5}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-ink-secondary hover:text-danger transition"
        >
          Log out
        </button>
      </div>
    </header>
    </div>
  );
}
