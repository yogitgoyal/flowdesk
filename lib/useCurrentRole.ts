"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/lib/workspaceStore";

type Role = "ADMIN" | "MEMBER";

// Resolves the logged-in user's role in the currently selected workspace.
// Used to gate nav items (hide, not just disable — see FINAL_BLUEPRINT.md §7)
// and to trim page content (e.g. analytics scope) between ADMIN and MEMBER.
export function useCurrentRole(): { role: Role | null; loading: boolean } {
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setRole(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRole() {
      try {
        setLoading(true);
        const [meRes, membersRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch(`/api/workspaces/${selectedWorkspaceId}/members`),
        ]);
        if (!meRes.ok || !membersRes.ok) throw new Error("Failed to resolve role");

        const me = await meRes.json();
        const membersData = await membersRes.json();
        const mine = (membersData.members as { id: string; role: Role }[]).find(
          (m) => m.id === me.id
        );
        const resolvedRole = mine?.role ?? null;
        if (!cancelled) setRole(resolvedRole);
        console.info("[useCurrentRole] resolved role", {
          selectedWorkspaceId,
          userId: me.id,
          resolvedRole,
        });
      } catch (err) {
        console.error("Failed to resolve current role:", err);
        if (!cancelled) setRole(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRole();
    return () => {
      cancelled = true;
    };
  }, [selectedWorkspaceId]);

  return { role, loading };
}
