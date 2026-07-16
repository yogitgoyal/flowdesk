"use client";

import { useEffect, useMemo, useState } from "react";
import SideRail from "@/components/SideRail";
import { apiFetch } from "@/lib/api-client";
import TopBar from "@/components/TopBar";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { useCurrentRole } from "@/lib/useCurrentRole";
import { formatTimestamp } from "@/lib/activity-format";

type Role = "ADMIN" | "MEMBER";

type ViewMode = "list" | "grid";

type Member = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  role: Role;
  lastActiveAt?: string | null;
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Full workspace access",
  MEMBER: "Can view and edit tasks",
};

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function MembersPage() {
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const { role: viewerRole } = useCurrentRole();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [actionMenuOpenFor, setActionMenuOpenFor] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState<string | null>(null);
  const [noAccountEmail, setNoAccountEmail] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!selectedWorkspaceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("No workspace selected");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        setInviteSuccessMessage(null);

        const q = encodeURIComponent(searchQuery.trim());
        const roleParam = roleFilter === "ALL" ? "" : `&role=${roleFilter}`;
        const [meRes, res] = await Promise.all([
          apiFetch("/api/auth/me"),
          apiFetch(
            `/api/workspaces/${selectedWorkspaceId}/members?page=${page}&limit=20${roleParam}&q=${q}`
          ),
        ]);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to load members");
        }

        const data = await res.json();
        if (cancelled) return;
        setMembers(data.members || []);
        setTotalPages(data.totalPages || 1);
        setTotalMembers(data.totalMembers || 0);
        setAdminCount(data.totalAdmins || 0);

        if (meRes.ok) {
          const me = await meRes.json();
          if (!cancelled) {
            setCurrentUserId(me.id);
          }
        } else {
          if (!cancelled) {
            setCurrentUserId(null);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedWorkspaceId, page, roleFilter, searchQuery]);

  const canManage = viewerRole === "ADMIN";

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.trim().toLowerCase();
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  async function handleInvite() {
    if (!selectedWorkspaceId || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccessMessage(null);
    setNoAccountEmail(null);
    setGeneratedLink(null);
    setLinkCopied(false);

    const emailToInvite = inviteEmail.trim().toLowerCase();

    try {
      const res = await apiFetch(`/api/workspaces/${selectedWorkspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToInvite, role: inviteRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 404) {
          setNoAccountEmail(emailToInvite);
          setInviteEmail(emailToInvite);
          return;
        }
        setInviteError(body.error ?? `Invite failed (${res.status})`);
        return;
      }

      const data = await res.json();
      if (data?.type === "pendingInvite") {
        setInviteSuccessMessage(`Invite sent to ${data.email}.`);
        if (data.url) {
          setGeneratedLink(`${window.location.origin}${data.url}`);
        }
      } else {
        setInviteSuccessMessage("Invite sent successfully.");
      }
      setInviteEmail("");
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Network error");
    } finally {
      setInviting(false);
    }
  }

  async function handleGenerateLink() {
    if (!selectedWorkspaceId || !noAccountEmail) return;
    setGeneratingLink(true);
    setInviteError(null);
    setInviteSuccessMessage(null);
    try {
      const res = await apiFetch(`/api/workspaces/${selectedWorkspaceId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: noAccountEmail, role: inviteRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setInviteError(body.error ?? `Could not generate invite link (${res.status})`);
        return;
      }
      const data = await res.json();
      setGeneratedLink(`${window.location.origin}${data.url}`);
      setNoAccountEmail(null);
      setInviteEmail("");
      setInviteSuccessMessage("Invite link generated successfully.");
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Network error");
    } finally {
      setGeneratingLink(false);
    }
  }

  async function handleCopyLink() {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard API can fail in some contexts; the link is still shown as text
    }
  }

  async function handleRoleChange(userId: string, newRole: Role) {
    if (!selectedWorkspaceId) return;

    const previous = members;
    setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m)));

    try {
      const res = await apiFetch(
        `/api/workspaces/${selectedWorkspaceId}/members/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Role change failed (${res.status})`);
        setMembers(previous);
      } else {
        const updated: Member = await res.json();
        setMembers((prev) => prev.map((m) => (m.id === userId ? updated : m)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setMembers(previous);
    }
  }

  async function handleRemoveMember(userId: string, name: string) {
    if (!selectedWorkspaceId) return;
    if (!window.confirm(`Remove ${name} from this workspace?`)) return;

    try {
      const res = await apiFetch(
        `/api/workspaces/${selectedWorkspaceId}/members/${userId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Remove failed (${res.status})`);
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== userId));
      setInviteSuccessMessage(`Removed ${name} from this workspace.`);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
  }

  return (
    <div className="min-h-screen flex bg-paper">
      <SideRail />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        <main className="flex-1 px-6 py-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-indigo-100 text-indigo-600">
                  👥
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-ink-secondary">Workspace members</p>
                  <h1 className="font-display text-3xl font-semibold text-ink">Members</h1>
                </div>
              </div>
              <span className="self-start text-sm font-medium text-ink-secondary bg-surface border border-border px-3 py-2 rounded-full card-elevated">
                Showing {members.length} of {totalMembers} member{totalMembers !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Invite Form Section */}
            {canManage && (
              <div className="bg-surface border border-border rounded-xl p-5 card-elevated flex flex-col gap-4">
                <div>
                  <h2 className="text-[10px] font-bold uppercase tracking-wider text-ink-secondary">
                    Invite New Member
                  </h2>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Add collaborators to this workspace by email.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value);
                      setNoAccountEmail(null);
                      setGeneratedLink(null);
                    }}
                    placeholder="name@domain.com"
                    className="flex-1 text-sm border border-border rounded-lg px-3.5 py-2.5 bg-paper focus:outline-none focus:ring-2 focus:ring-indigo transition-shadow"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Role)}
                    className="text-sm border border-border rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:ring-2 focus:ring-indigo transition-shadow"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="px-5 py-2.5 rounded-lg bg-indigo text-white text-sm font-medium hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 disabled:pointer-events-none shrink-0"
                  >
                    {inviting ? "Inviting..." : "Send Invite"}
                  </button>
                </div>

                {inviteError && (
                  <p className="text-xs font-medium text-danger bg-danger/10 border border-danger/25 px-3 py-2 rounded-lg">
                    {inviteError}
                  </p>
                )}

                {inviteSuccessMessage && (
                  <p className="text-xs font-medium text-emerald bg-emerald/10 border border-emerald/25 px-3 py-2 rounded-lg">
                    {inviteSuccessMessage}
                  </p>
                )}

                {noAccountEmail && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-warning/30 bg-warning/5">
                    <p className="text-xs text-ink leading-relaxed">
                      No account exists yet for <span className="font-mono font-medium">{noAccountEmail}</span>.
                    </p>
                    <button
                      onClick={handleGenerateLink}
                      disabled={generatingLink}
                      className="text-xs font-semibold text-indigo hover:opacity-80 transition shrink-0 disabled:opacity-50"
                    >
                      {generatingLink ? "Generating..." : "Generate invite link instead"}
                    </button>
                  </div>
                )}

                {generatedLink && (
                  <div className="flex flex-col gap-2 px-3 py-2.5 rounded-lg border border-border bg-paper">
                    <p className="text-xs text-ink-secondary font-medium">
                      Share this link with them. Expires in 7 days.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={generatedLink}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="flex-1 text-xs font-mono bg-surface border border-border rounded px-2.5 py-1.5 focus:outline-none"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="text-xs font-semibold text-indigo hover:opacity-85 transition shrink-0 bg-surface border border-border rounded px-3 py-1.5 hover:bg-paper"
                      >
                        {linkCopied ? "Copied!" : "Copy Link"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Members Directory Card */}
            <div className="bg-surface border border-border rounded-xl card-elevated flex flex-col overflow-hidden">
              {/* Directory Header with Search */}
              <div className="px-5 py-4 border-b border-border bg-surface">
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-center">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-secondary text-base">⌕</span>
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search members by name or email..."
                      className="w-full text-sm bg-paper border border-border rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo transition-shadow"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-secondary">
                        All roles
                      </span>
                      <select
                        value={roleFilter}
                        onChange={(e) => {
                          setRoleFilter(e.target.value as "ALL" | Role);
                          setPage(1);
                        }}
                        className="text-sm text-ink bg-surface outline-none"
                      >
                        <option value="ALL">All roles</option>
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Member</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewMode((current) => (current === "list" ? "grid" : "list"))}
                      className="inline-flex items-center justify-center rounded-full border border-border bg-surface p-2 text-ink-secondary hover:border-ink-secondary hover:text-ink transition"
                      aria-label={viewMode === "list" ? "Show grid view" : "Show list view"}
                    >
                      <span className="text-sm">{viewMode === "list" ? "▢" : "≡"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {viewMode === "list" ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-surface text-left text-xs uppercase tracking-[0.2em] text-ink-secondary">
                        <th className="px-5 py-4 rounded-tl-2xl">Member</th>
                        <th className="px-5 py-4">Role</th>
                        <th className="px-5 py-4">Last active</th>
                        <th className="px-5 py-4 rounded-tr-2xl">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-6 text-sm text-ink-secondary">
                            Loading members...
                          </td>
                        </tr>
                      ) : error ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-6 text-sm text-danger font-medium">
                            {error}
                          </td>
                        </tr>
                      ) : filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-6 text-sm text-ink-secondary">
                            {members.length === 0
                              ? "No members yet."
                              : `No members match "${searchQuery}".`}
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((member) => {
                            const isSoleAdmin = member.role === "ADMIN" && adminCount === 1;
                            const currentRoleDescription = ROLE_DESCRIPTIONS[member.role];
                            const lastActiveLabel = member.lastActiveAt
                              ? formatRelativeTime(member.lastActiveAt)
                              : "No activity";

                            return (
                              <tr key={member.id} className="border-t border-border last:border-b-0">
                                <td className="px-5 py-4 align-top">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                                      style={{ backgroundColor: member.avatarColor }}
                                    >
                                      {member.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-ink truncate">{member.name}</p>
                                      <p className="text-xs text-ink-secondary truncate mt-0.5">{member.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-4 align-top">
                                  <div className="inline-flex flex-col gap-1">
                                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-paper px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary">
                                      {member.role}
                                    </span>
                                    <span className="text-xs text-ink-secondary">{currentRoleDescription}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-4 align-top">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex h-2.5 w-2.5 rounded-full ${member.lastActiveAt ? "bg-teal" : "bg-ink-secondary/30"}`} />
                                    <div className="flex flex-col">
                                      <span className="text-sm text-ink">{lastActiveLabel}</span>
                                      {member.lastActiveAt ? (
                                        <span className="text-xs text-ink-secondary">{formatTimestamp(member.lastActiveAt)}</span>
                                      ) : null}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-4 align-top text-right">
                                  <div className="relative inline-flex">
                                    <button
                                      type="button"
                                      onClick={() => setActionMenuOpenFor(actionMenuOpenFor === member.id ? null : member.id)}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary hover:text-ink transition"
                                      aria-label="Open member actions"
                                    >
                                      ⋯
                                    </button>
                                    {actionMenuOpenFor === member.id && (
                                      <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl border border-border bg-surface shadow-lg z-10">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActionMenuOpenFor(null);
                                            const newRole = member.role === "ADMIN" ? "MEMBER" : "ADMIN";
                                            handleRoleChange(member.id, newRole);
                                          }}
                                          disabled={!canManage || isSoleAdmin}
                                          className="w-full px-4 py-3 text-left text-sm text-ink-secondary hover:bg-indigo/5 disabled:text-ink-secondary/60"
                                        >
                                          {member.role === "ADMIN" ? "Make Member" : "Make Admin"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActionMenuOpenFor(null);
                                            if (canManage && member.id !== currentUserId) {
                                              handleRemoveMember(member.id, member.name);
                                            }
                                          }}
                                          disabled={!canManage || member.id === currentUserId || isSoleAdmin}
                                          className="w-full px-4 py-3 text-left text-sm text-ink-secondary hover:bg-indigo/5 disabled:text-ink-secondary/60 border-t border-border"
                                        >
                                          Remove member
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  {loading ? (
                    <p className="text-sm text-ink-secondary col-span-2">Loading members...</p>
                  ) : error ? (
                    <p className="text-sm text-danger col-span-2 font-medium">{error}</p>
                  ) : filteredMembers.length === 0 ? (
                    <p className="text-sm text-ink-secondary col-span-2">
                      {members.length === 0
                        ? "No members yet."
                        : `No members match "${searchQuery}".`}
                    </p>
                  ) : (
                    filteredMembers.map((member) => {
                        const isSoleAdmin = member.role === "ADMIN" && adminCount === 1;
                        const currentRoleDescription = ROLE_DESCRIPTIONS[member.role];
                        const lastActiveLabel = member.lastActiveAt
                          ? formatRelativeTime(member.lastActiveAt)
                          : "No activity";
                        const roleColorMap = {
                          ADMIN: "bg-amber/10 text-amber border-amber/20",
                          MEMBER: "bg-indigo/10 text-indigo border-indigo/20",
                        }[member.role];

                        return (
                          <div key={member.id} className="rounded-3xl border border-border p-5 bg-paper">
                            <div className="flex items-start gap-4">
                              <div
                                className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white"
                                style={{ backgroundColor: member.avatarColor }}
                              >
                                {member.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-ink truncate">{member.name}</p>
                                <p className="text-xs text-ink-secondary truncate mt-0.5">{member.email}</p>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2 items-start">
                              <div>
                                <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${roleColorMap}`}>
                                  {member.role}
                                </span>
                                <p className="text-xs text-ink-secondary mt-2">{currentRoleDescription}</p>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-sm text-ink-secondary">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex h-2.5 w-2.5 rounded-full ${member.lastActiveAt ? "bg-teal" : "bg-ink-secondary/30"}`} />
                                  <div className="flex flex-col">
                                    <span className="text-sm text-ink">{lastActiveLabel}</span>
                                    {member.lastActiveAt ? (
                                      <span className="text-xs text-ink-secondary">{formatTimestamp(member.lastActiveAt)}</span>
                                    ) : null}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(member.id, member.name)}
                                  disabled={!canManage || member.id === currentUserId || isSoleAdmin}
                                  className="text-xs font-semibold text-danger hover:text-danger/80 disabled:text-ink-secondary disabled:cursor-not-allowed"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border bg-surface px-5 py-4 text-xs text-ink-secondary">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                    className="rounded-full border border-border px-3 py-1 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page >= totalPages}
                    className="rounded-full border border-border px-3 py-1 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

