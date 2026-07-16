"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type InviteDetails = {
  email: string;
  role: "ADMIN" | "MEMBER";
  workspace: { id: string; name: string };
  invitedByName: string;
  expiresAt: string;
};

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invites/${token}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "This invite is invalid");
          return;
        }
        const data = await res.json();
        if (!cancelled) setInvite(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setMe({ id: data.id, email: data.email });
        }
      } catch {
        // not signed in -- that's fine
      }
    })();
  }, []);

  async function accept() {
    if (!token) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not accept invite");
        return;
      }
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-paper">
        <p className="text-sm text-ink-secondary">Loading invite...</p>
      </main>
    );
  }

  if (error || !invite) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-paper">
        <div className="max-w-md flex flex-col gap-3 text-center">
          <h1 className="font-display text-2xl font-semibold">Invite unavailable</h1>
          <p className="text-sm text-danger">{error ?? "This invite is invalid or has expired."}</p>
        </div>
      </main>
    );
  }

  const isCorrectUser = me && me.email.toLowerCase() === invite.email.toLowerCase();

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper px-6">
      <div className="max-w-md w-full bg-surface border border-border rounded-lg p-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-ink-secondary uppercase tracking-wide">You&apos;re invited to</span>
          <h1 className="font-display text-2xl font-semibold">{invite.workspace.name}</h1>
        </div>

        <p className="text-sm text-ink-secondary">
          <span className="font-medium text-ink">{invite.invitedByName}</span> invited you to join
          as a <span className="font-medium text-ink">{invite.role}</span>.
        </p>

        {!me ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">Sign in or create an account to accept:</p>
            <div className="flex gap-2">
              <a
                href={`/login?redirect=/invite/${token}`}
                className="flex-1 text-center px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-paper transition"
              >
                Sign in
              </a>
              <a
                href={`/login?tab=signup&redirect=/invite/${token}`}
                className="flex-1 text-center px-4 py-2 rounded-md bg-indigo text-white text-sm font-medium hover:opacity-90 transition"
              >
                Sign up
              </a>
            </div>
            <p className="text-xs text-ink-secondary">
              Sign up with <span className="font-mono">{invite.email}</span> to accept this invite.
            </p>
          </div>
        ) : !isCorrectUser ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-danger">
              You&apos;re signed in as <span className="font-mono">{me.email}</span>, but this invite
              was sent to <span className="font-mono">{invite.email}</span>. Sign out and sign in
              with the correct account.
            </p>
            <a
              href="/api/auth/logout"
              className="self-start text-xs text-ink-secondary hover:text-ink underline"
            >
              Sign out
            </a>
          </div>
        ) : (
          <button
            onClick={accept}
            disabled={accepting}
            className="self-start px-4 py-2 rounded-md bg-indigo text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {accepting ? "Joining..." : `Join ${invite.workspace.name}`}
          </button>
        )}
      </div>
    </main>
  );
}

