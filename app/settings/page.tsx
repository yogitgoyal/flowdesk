"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SideRail from "@/components/SideRail";
import TopBar from "@/components/TopBar";
import { apiFetch } from "@/lib/api-client";
import ThemeToggle from "@/components/ThemeToggle";
import { useWorkspaceStore } from "@/lib/workspaceStore";

type Role = "ADMIN" | "MEMBER";

type AuthUser = { id: string; name: string; email: string; avatarColor: string };

export default function SettingsPage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setAuthUser(data); })
      .catch(() => {});
  }, []);


  const router = useRouter();
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const setSelectedWorkspaceId = useWorkspaceStore((s) => s.setSelectedWorkspaceId);
  const setCurrentProject = useWorkspaceStore((s) => s.setCurrentProject);

  const [wsLoading, setWsLoading] = useState(true);
  const [wsError, setWsError] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [myRole, setMyRole] = useState<Role | null>(null);

  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSaved, setRenameSaved] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        setWsLoading(true);
        setWsError(null);

        const meRes = await apiFetch("/api/auth/me");
        if (!meRes.ok) throw new Error("Not authenticated");
        const me = await meRes.json();

        const wsRes = await apiFetch("/api/workspaces");
        if (!wsRes.ok) throw new Error("Failed to load workspace");
        const workspaces = await wsRes.json();
        const ws = workspaces.find((w: { id: string }) => w.id === selectedWorkspaceId);
        if (!ws) throw new Error("Workspace not found");
        if (cancelled) return;
        setWorkspaceName(ws.name);
        setRenameValue(ws.name);

        const membersRes = await apiFetch(`/api/workspaces/${selectedWorkspaceId}/members`);
        if (!membersRes.ok) throw new Error("Failed to load membership");
        const membersData = await membersRes.json();
        const myMembership = membersData.members.find(
          (m: { id: string }) => m.id === me.id
        );
        if (cancelled) return;
        setMyRole(myMembership?.role ?? null);
      } catch (e) {
        if (!cancelled) setWsError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (!cancelled) setWsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedWorkspaceId]);

  async function handleRename() {
    const trimmed = renameValue.trim();
    if (!trimmed || !selectedWorkspaceId) return;
    setRenaming(true);
    setRenameError(null);
    setRenameSaved(false);
    try {
      const res = await apiFetch(`/api/workspaces/${selectedWorkspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRenameError(data.error ?? "Failed to rename workspace");
        return;
      }
      setWorkspaceName(data.name);
      setRenameSaved(true);
      setTimeout(() => setRenameSaved(false), 2000);
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : "Network error");
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete() {
    if (!selectedWorkspaceId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await apiFetch(`/api/workspaces/${selectedWorkspaceId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: deleteConfirmText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error ?? "Failed to delete workspace");
        return;
      }
      setSelectedWorkspaceId(null);
      setCurrentProject(null);
      router.push("/workspaces");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Network error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleLeave() {
    if (!selectedWorkspaceId) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      const res = await apiFetch(`/api/workspaces/${selectedWorkspaceId}/leave`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setLeaveError(data.error ?? "Failed to leave workspace");
        return;
      }
      setSelectedWorkspaceId(null);
      setCurrentProject(null);
      router.push("/workspaces");
    } catch (e) {
      setLeaveError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLeaving(false);
    }
  }

  const isAdmin = myRole === "ADMIN";

  return (
    <div className="min-h-screen flex bg-paper">
      <SideRail />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 px-6 py-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            <div className="flex flex-col gap-6 rounded-3xl border border-border bg-surface p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-indigo-100 text-indigo-600">
                    ⚙️
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-ink-secondary">Workspace settings</p>
                    <h1 className="font-display text-3xl font-semibold text-ink">Settings</h1>
                  </div>
                </div>
                <div className="rounded-full border border-border bg-paper px-4 py-2 text-sm font-semibold text-ink-secondary">
                  {workspaceName || "Workspace settings"}
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-ink-secondary">
                Manage your workspace name, profile details, appearance settings, and workspace access controls from one central place.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
              <div className="space-y-6">
                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-ink-secondary">Profile</p>
                      <h2 className="text-lg font-semibold text-ink">Account information</h2>
                    </div>
                    <span className="rounded-full bg-paper px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-ink-secondary">
                      Read only
                    </span>
                  </div>
                  <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
                    {authUser ? (
                      <div className="flex items-center gap-4">
                        <div
                          className="h-14 w-14 rounded-3xl flex items-center justify-center text-base font-semibold text-white"
                          style={{ backgroundColor: authUser.avatarColor }}
                        >
                          {authUser.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{authUser.name}</p>
                          <p className="text-sm text-ink-secondary truncate">{authUser.email}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-3xl bg-paper animate-pulse" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 w-2/5 rounded-full bg-paper animate-pulse" />
                          <div className="h-3 w-1/2 rounded-full bg-paper animate-pulse" />
                        </div>
                      </div>
                    )}
                    <p className="mt-5 text-sm leading-6 text-ink-secondary">
                      Profile editing is not yet available. Name and email are read-only.
                    </p>
                  </div>
                </section>

                <section className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-ink-secondary">Workspace</p>
                    <h2 className="text-lg font-semibold text-ink">Workspace settings</h2>
                  </div>
                  <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
                    {wsLoading ? (
                      <p className="text-sm text-ink-secondary">Loading workspace settings...</p>
                    ) : wsError ? (
                      <p className="text-sm text-danger">{wsError}</p>
                    ) : (
                      <>
                        {isAdmin ? (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-ink" htmlFor="wsname">
                                Workspace name
                              </label>
                              <input
                                id="wsname"
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="w-full rounded-3xl border border-border bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-indigo"
                              />
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                              <button
                                onClick={handleRename}
                                disabled={renaming || !renameValue.trim() || renameValue.trim() === workspaceName}
                                className="inline-flex items-center justify-center rounded-3xl bg-indigo px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                              >
                                {renaming ? "Saving..." : renameSaved ? "Saved" : "Save"}
                              </button>
                              {renameError && <p className="text-sm text-danger">{renameError}</p>}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-ink">{workspaceName}</p>
                            <p className="text-sm text-ink-secondary">
                              Only workspace owners can rename this workspace.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-ink-secondary">Appearance</p>
                    <h2 className="text-lg font-semibold text-ink">Theme</h2>
                  </div>
                  <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-ink">App theme</p>
                      <p className="text-sm text-ink-secondary">Switch between light and dark mode.</p>
                    </div>
                    <ThemeToggle />
                  </div>
                </section>

                {isAdmin ? (
                  <section className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-danger">Danger zone</p>
                      <h2 className="text-lg font-semibold text-ink">Workspace removal</h2>
                    </div>
                    <div className="rounded-3xl border border-danger bg-surface p-6 shadow-sm">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-ink">Delete this workspace</p>
                          <p className="text-sm text-ink-secondary">
                            Permanently delete all projects, tasks, and members in this workspace. This cannot be undone.
                          </p>
                        </div>
                        {!showDeleteConfirm ? (
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="inline-flex items-center justify-center rounded-3xl border border-danger px-4 py-3 text-sm font-semibold text-danger transition hover:bg-danger/10"
                          >
                            Delete workspace
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <label className="text-sm text-ink-secondary">
                              Type <span className="font-mono font-semibold text-ink">{workspaceName}</span> to confirm.
                            </label>
                            <input
                              type="text"
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              className="w-full rounded-3xl border border-danger bg-paper px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-danger"
                            />
                            {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <button
                                onClick={() => {
                                  setShowDeleteConfirm(false);
                                  setDeleteConfirmText("");
                                  setDeleteError(null);
                                }}
                                className="inline-flex items-center justify-center rounded-3xl border border-border px-4 py-3 text-sm font-semibold text-ink transition hover:bg-paper"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleDelete}
                                disabled={deleting || deleteConfirmText.trim() !== workspaceName}
                                className="inline-flex items-center justify-center rounded-3xl bg-danger px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                              >
                                {deleting ? "Deleting..." : "Permanently delete"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                ) : myRole ? (
                  <section className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-danger">Danger zone</p>
                      <h2 className="text-lg font-semibold text-ink">Leave workspace</h2>
                    </div>
                    <div className="rounded-3xl border border-danger bg-surface p-6 shadow-sm">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-ink">Leave this workspace</p>
                          <p className="text-sm text-ink-secondary">
                            You will lose access to all projects and tasks in this workspace.
                          </p>
                        </div>
                        {!showLeaveConfirm ? (
                          <button
                            onClick={() => setShowLeaveConfirm(true)}
                            className="inline-flex items-center justify-center rounded-3xl border border-danger px-4 py-3 text-sm font-semibold text-danger transition hover:bg-danger/10"
                          >
                            Leave workspace
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-ink">Are you sure you want to leave?</p>
                            {leaveError && <p className="text-sm text-danger">{leaveError}</p>}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <button
                                onClick={() => setShowLeaveConfirm(false)}
                                className="inline-flex items-center justify-center rounded-3xl border border-border px-4 py-3 text-sm font-semibold text-ink transition hover:bg-paper"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleLeave}
                                disabled={leaving}
                                className="inline-flex items-center justify-center rounded-3xl bg-danger px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                              >
                                {leaving ? "Leaving..." : "Leave workspace"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                ) : null}
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
