"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { useUserStore } from "@/lib/userStore";
import { apiFetch } from "@/lib/api-client";

type Role = "ADMIN" | "MEMBER";

export function useCurrentRole(): { role: Role | null; loading: boolean } {
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const cachedRole = useUserStore((s) =>
    selectedWorkspaceId ? s.roleByWorkspace[selectedWorkspaceId] ?? null : null
  );
  const setRoleForWorkspace = useUserStore((s) => s.setRoleForWorkspace);

  const [role, setRole] = useState<Role | null>(cachedRole);
  const [loading, setLoading] = useState(!cachedRole);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset state when workspace selection is cleared
      setRole(null);
      setLoading(false);
      return;
    }

    // Captured as a new const so TypeScript keeps it narrowed to `string`
    // inside loadRole()'s closure below -- selectedWorkspaceId itself stays
    // typed as `string | null` there otherwise.
    const workspaceId = selectedWorkspaceId;
    const alreadyCached = cachedRole !== null;
    if (alreadyCached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed from cache immediately to avoid a remount flash
      setRole(cachedRole);
      setLoading(false);
    }

    let cancelled = false;

    async function loadRole() {
      try {
        if (!alreadyCached) setLoading(true);
        const [meRes, membersRes] = await Promise.all([
          apiFetch("/api/auth/me"),
          apiFetch(`/api/workspaces/${workspaceId}/members`),
        ]);
        if (!meRes.ok || !membersRes.ok) throw new Error("Failed to resolve role");

        const me = await meRes.json();
        const membersData = await membersRes.json();
        const mine = (membersData.members as { id: string; role: Role }[]).find(
          (m) => m.id === me.id
        );
        const resolvedRole = mine?.role ?? null;
        if (!cancelled) {
          setRole(resolvedRole);
          if (resolvedRole) setRoleForWorkspace(workspaceId, resolvedRole);
        }
      } catch (err) {
        console.error("Failed to resolve current role:", err);
        if (!cancelled && !alreadyCached) setRole(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRole();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cachedRole intentionally excluded, only selectedWorkspaceId should retrigger the fetch
  }, [selectedWorkspaceId]);

  return { role, loading };
}