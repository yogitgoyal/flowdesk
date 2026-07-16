"use client";


import { useEffect, useState } from "react";

import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";

import { useWorkspaceStore } from "@/lib/workspaceStore";


// Local types — match what /api/workspaces actually returns.

type Workspace = {

  id: string;

  name: string;

  ownerId: string;

  memberCount: number;

  projectCount?: number; // optional — only present if the API returns it

};


type Member = {

  id: string;

  name: string;

  avatarColor?: string;

};


type CurrentUser = {

  id: string;

  name: string;

  email: string;

};


const PALETTE = ["#E8A33D", "#2E8B87", "#C74E79", "#4A5FD1"];


// Deterministic color picker — used when a member doesn't have an avatarColor

// (so we don't end up with all-white circles).

function colorFromId(id: string): string {

  let hash = 0;

  for (let i = 0; i < id.length; i++) {

    hash = (hash + id.charCodeAt(i)) % PALETTE.length;

  }

  return PALETTE[hash];

}


export default function WorkspacesPage() {

  const router = useRouter();

  const setSelectedWorkspaceId = useWorkspaceStore((s) => s.setSelectedWorkspaceId);

  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);

  const setCurrentProject = useWorkspaceStore((s) => s.setCurrentProject);


  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const [loading, setLoading] = useState(true);

  const [err, setErr] = useState<string | null>(null);


  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);


  const [showCreate, setShowCreate] = useState(false);

  const [newName, setNewName] = useState("");

  const [creating, setCreating] = useState(false);

  const [createError, setCreateError] = useState<string | null>(null);


  // Per-workspace member lists, keyed by workspace id.

  const [workspaceMembers, setWorkspaceMembers] = useState<Record<string, Member[]>>({});


  // 1. Greet the user (graceful: if /api/auth/me 401s, just show generic greeting).

  useEffect(() => {

    let cancelled = false;

    (async () => {

      try {

        const res = await apiFetch("/api/auth/me");

        if (res.ok) {

          const data: CurrentUser = await res.json();

          if (!cancelled) setCurrentUser(data);

        }

      } catch {

        /* silent — greeting will fall back to "there" */

      }

    })();

    return () => {

      cancelled = true;

    };

  }, []);


  // 2. Load workspaces + fire member fetches in parallel.

  useEffect(() => {

    let cancelled = false;

    (async () => {

      try {

        setLoading(true);

        const res = await apiFetch("/api/workspaces");

        if (!res.ok) throw new Error("Failed to load workspaces");

        const raw: unknown = await res.json();

        if (cancelled) return;


        // Tolerate either a bare array OR a wrapper like { workspaces: [...] }.

        const data: Workspace[] = Array.isArray(raw)

          ? (raw as Workspace[])

          : raw && Array.isArray((raw as { workspaces?: unknown }).workspaces)

          ? ((raw as { workspaces: Workspace[] }).workspaces)

          : [];


        setWorkspaces(data);


        // Best-effort member fetch per workspace. Silent fail if missing.

        data.forEach((ws) => {

          apiFetch(`/api/workspaces/${ws.id}/members`)

            .then((r) => (r.ok ? r.json() : null))

            .then((raw2: unknown) => {

              if (cancelled) return;

              const list: Member[] = Array.isArray(raw2)

                ? (raw2 as Member[])

                : raw2 && Array.isArray((raw2 as { members?: unknown }).members)

                ? ((raw2 as { members: Member[] }).members)

                : [];

              setWorkspaceMembers((prev) => ({ ...prev, [ws.id]: list }));

            })

            .catch(() => {

              /* keep count-only display */

            });

        });

      } catch (e) {

        if (!cancelled) setErr(e instanceof Error ? e.message : "Something went wrong");

      } finally {

        if (!cancelled) setLoading(false);

      }

    })();

    return () => {

      cancelled = true;

    };

  }, []);


  function handleSelect(workspaceId: string, workspaceName: string) {

    setSelectedWorkspaceId(workspaceId);

    setCurrentWorkspace({ id: workspaceId, name: workspaceName });

    setCurrentProject(null);

    router.push("/dashboard");

  }


  async function handleCreateSubmit() {

    const trimmed = newName.trim();

    if (!trimmed) return;


    setCreating(true);

    setCreateError(null);


    try {

      const res = await apiFetch("/api/workspaces", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ name: trimmed }),

      });


      const data = await res.json();


      if (!res.ok) {

        setCreateError(data.error ?? "Failed to create workspace");

        return;

      }


      setWorkspaces((prev) => [...prev, data]);

      setSelectedWorkspaceId(data.id);

      setCurrentWorkspace({ id: data.id, name: data.name });

      setNewName("");

      setShowCreate(false);

    } catch {

      setCreateError("Network error — please try again");

    } finally {

      setCreating(false);

    }

  }


  const firstName = currentUser?.name?.split(" ")[0];


  return (

    <main className="min-h-screen relative overflow-hidden bg-paper flex flex-col">

      {/* Ambient gradients + dot grid (same system as login page) */}

      <div className="pointer-events-none absolute -top-32 -left-20 w-[600px] h-[600px] bg-amber/15 rounded-full blur-3xl" />

      <div className="pointer-events-none absolute -bottom-32 -right-20 w-[600px] h-[600px] bg-teal/15 rounded-full blur-3xl" />

      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo/5 rounded-full blur-3xl" />

      <div

        className="pointer-events-none absolute inset-0 opacity-[0.4]"

        style={{

          backgroundImage:

            "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",

          backgroundSize: "24px 24px",

        }}

      />


      {/* Top bar — user/logout UI removed per request */}

      <header className="relative z-10 px-6 lg:px-10 py-4 flex items-center justify-between shrink-0">

        <Link href="/" className="font-display text-lg font-semibold tracking-tight">

          FlowDesk

        </Link>

      </header>


      {/* Center stage — compact so everything fits in one viewport */}

      <section className="relative z-10 flex-1 flex items-center justify-center px-6 py-2">

        <div className="w-full max-w-xl flex flex-col items-center text-center">

          {/* Greeting — tighter than before */}

          <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-tight tracking-tight mb-2">

            Welcome back{firstName ? `, ${firstName}` : ""}.{" "}

            <span className="inline-block origin-[70%_70%]">👋</span>

          </h1>

          <p className="text-sm text-ink-secondary mb-6 max-w-md leading-relaxed">

            Pick up where you left off. Choose a workspace to get started.

          </p>


          {/* Workspace list */}

          {loading ? (

            <div className="w-full flex flex-col gap-3">

              <div className="bg-surface border border-border rounded-xl p-4 h-[72px] animate-pulse" />

              <div className="bg-surface border border-border rounded-xl p-4 h-[72px] animate-pulse" />

            </div>

          ) : err ? (

            <p className="text-sm text-danger bg-danger/10 px-4 py-3 rounded-lg w-full">

              {err}

            </p>

          ) : workspaces.length === 0 ? (

            <div className="w-full bg-surface border border-border rounded-xl p-5">

              <p className="text-sm text-ink-secondary">

                You don&apos;t have any workspaces yet. Create your first one below.

              </p>

            </div>

          ) : (

            <div className="w-full flex flex-col gap-3">

              {workspaces.map((ws, i) => (

                <WorkspaceCard

                  key={ws.id}

                  workspace={ws}

                  members={workspaceMembers[ws.id] ?? []}

                  color={PALETTE[i % PALETTE.length]}

                  onClick={() => handleSelect(ws.id, ws.name)}

                />

              ))}

            </div>

          )}


          {/* OR divider */}

          {workspaces.length > 0 && !loading && !err && (

            <div className="w-full flex items-center gap-4 my-5">

              <div className="flex-1 h-px bg-border" />

              <span className="text-[10px] uppercase tracking-[0.2em] text-ink-secondary font-semibold">

                or

              </span>

              <div className="flex-1 h-px bg-border" />

            </div>

          )}


          {/* Create workspace */}

          {!showCreate ? (

            <button

              type="button"

              onClick={() => setShowCreate(true)}

              className="w-full bg-transparent border-2 border-dashed border-border hover:border-indigo rounded-xl px-5 py-3 text-ink-secondary hover:text-indigo transition flex items-center justify-center gap-3 group"

            >

              <span className="w-7 h-7 rounded-lg bg-paper group-hover:bg-indigo/10 flex items-center justify-center transition">

                <svg

                  width="14"

                  height="14"

                  viewBox="0 0 24 24"

                  fill="none"

                  stroke="currentColor"

                  strokeWidth="2"

                  strokeLinecap="round"

                >

                  <path d="M12 5v14M5 12h14" />

                </svg>

              </span>

              <span className="text-sm font-medium">Create a new workspace</span>

            </button>

          ) : (

            <CreateWorkspaceForm

              value={newName}

              onChange={setNewName}

              onSubmit={handleCreateSubmit}

              onCancel={() => {

                setShowCreate(false);

                setNewName("");

                setCreateError(null);

              }}

              creating={creating}

              error={createError}

            />

          )}


          {/* Feature highlights — compact row at bottom */}

          <div className="grid sm:grid-cols-3 gap-5 mt-8 w-full text-left">

            <Feature

              icon={<UsersIcon />}

              title="All your work, organized"

              description="Projects, tasks, people — one place."

            />

            <Feature

              icon={<BoltIcon />}

              title="Real-time collaboration"

              description="See what's changing, instantly."

            />

            <Feature

              icon={<ShieldIcon />}

              title="Secure & private"

              description="Encrypted. Always protected."

            />

          </div>

        </div>

      </section>

    </main>

  );

}


// ────────────────────────────────────────────────────────────────────────────

// Sub-components

// ────────────────────────────────────────────────────────────────────────────


function WorkspaceCard({

  workspace,

  members,

  color,

  onClick,

}: {

  workspace: Workspace;

  members: Member[];

  color: string;

  onClick: () => void;

}) {

  const visible = members.slice(0, 4);

  const overflow = Math.max(0, members.length - visible.length);


  return (

    <button

      type="button"

      onClick={onClick}

      className="w-full bg-surface border border-border hover:border-indigo rounded-xl p-4 flex items-center gap-4 text-left transition group"

    >

      {/* Workspace initial tile */}

      <div

        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold text-sm shrink-0"

        style={{ backgroundColor: color }}

      >

        {workspace.name.charAt(0).toUpperCase()}

      </div>


      {/* Name + counts */}

      <div className="flex-1 min-w-0">

        <div className="font-medium text-ink truncate">{workspace.name}</div>

        <div className="text-xs text-ink-secondary mt-0.5">

          {workspace.memberCount}{" "}

          {workspace.memberCount === 1 ? "member" : "members"}

          {workspace.projectCount !== undefined && (

            <>

              {" · "}

              {workspace.projectCount}{" "}

              {workspace.projectCount === 1 ? "project" : "projects"}

            </>

          )}

        </div>

      </div>


      {/* Member avatar stack */}

      <div className="flex -space-x-2 shrink-0">

        {visible.map((m) => (

          <div

            key={m.id}

            title={m.name}

            className="w-7 h-7 rounded-full border-2 border-surface flex items-center justify-center text-[10px] font-semibold text-white"

            style={{ backgroundColor: m.avatarColor ?? colorFromId(m.id) }}

          >

            {m.name.charAt(0).toUpperCase()}

          </div>

        ))}

        {overflow > 0 && (

          <div className="w-7 h-7 rounded-full border-2 border-surface bg-paper text-ink-secondary flex items-center justify-center text-[10px] font-semibold">

            +{overflow}

          </div>

        )}

      </div>

    </button>

  );

}


function CreateWorkspaceForm({

  value,

  onChange,

  onSubmit,

  onCancel,

  creating,

  error,

}: {

  value: string;

  onChange: (v: string) => void;

  onSubmit: () => void;

  onCancel: () => void;

  creating: boolean;

  error: string | null;

}) {

  return (

    <div className="w-full bg-surface border border-border rounded-xl p-4">

      <input

        autoFocus

        value={value}

        onChange={(e) => onChange(e.target.value)}

        onKeyDown={(e) => {

          if (e.key === "Enter") onSubmit();

          if (e.key === "Escape") onCancel();

        }}

        placeholder="Workspace name"

        className="w-full bg-paper border border-border focus:border-indigo rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-secondary outline-none transition"

      />

      {error && (

        <p className="mt-2 text-xs text-danger bg-danger/10 px-3 py-2 rounded">

          {error}

        </p>

      )}

      <div className="flex gap-2 mt-3">

        <button

          type="button"

          onClick={onCancel}

          disabled={creating}

          className="flex-1 px-3 py-2 rounded-lg border border-border text-ink-secondary hover:text-ink hover:bg-paper transition text-sm font-medium disabled:opacity-50"

        >

          Cancel

        </button>

        <button

          type="button"

          onClick={onSubmit}

          disabled={creating || !value.trim()}

          className="flex-1 px-3 py-2 rounded-lg bg-indigo text-white hover:opacity-90 transition text-sm font-medium disabled:opacity-50"

        >

          {creating ? "Creating…" : "Create"}

        </button>

      </div>

    </div>

  );

}


function Feature({

  icon,

  title,

  description,

}: {

  icon: React.ReactNode;

  title: string;

  description: string;

}) {

  return (

    <div>

      <div className="w-8 h-8 rounded-lg bg-paper border border-border flex items-center justify-center text-indigo mb-2">

        {icon}

      </div>

      <div className="text-sm font-medium text-ink mb-0.5">{title}</div>

      <div className="text-xs text-ink-secondary leading-relaxed">{description}</div>

    </div>

  );

}


function UsersIcon() {

  return (

    <svg

      width="16"

      height="16"

      viewBox="0 0 24 24"

      fill="none"

      stroke="currentColor"

      strokeWidth="2"

      strokeLinecap="round"

      strokeLinejoin="round"

    >

      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />

      <circle cx="9" cy="7" r="4" />

      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />

      <path d="M16 3.13a4 4 0 0 1 0 7.75" />

    </svg>

  );

}


function BoltIcon() {

  return (

    <svg

      width="16"

      height="16"

      viewBox="0 0 24 24"

      fill="none"

      stroke="currentColor"

      strokeWidth="2"

      strokeLinecap="round"

      strokeLinejoin="round"

    >

      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />

    </svg>

  );

}


function ShieldIcon() {

  return (

    <svg

      width="16"

      height="16"

      viewBox="0 0 24 24"

      fill="none"

      stroke="currentColor"

      strokeWidth="2"

      strokeLinecap="round"

      strokeLinejoin="round"

    >

      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />

    </svg>

  );

}