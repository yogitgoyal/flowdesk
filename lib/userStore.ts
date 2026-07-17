import { create } from "zustand";

type Role = "ADMIN" | "MEMBER";

type CurrentUser = { id: string; name: string; avatarColor: string } | null;

type UserStore = {
  currentUser: CurrentUser;
  setCurrentUser: (user: CurrentUser) => void;
  roleByWorkspace: Record<string, Role>;
  setRoleForWorkspace: (workspaceId: string, role: Role) => void;
};

// Caches identity/role across page navigations. SideRail and useCurrentRole
// both remount on every route change (see the "Team flickers on every click"
// investigation), which reset their local useState to null/loading each
// time. Reading/writing through this shared store instead means a remounted
// component can show the already-known value immediately, then silently
// refresh in the background -- no visible flash.
export const useUserStore = create<UserStore>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  roleByWorkspace: {},
  setRoleForWorkspace: (workspaceId, role) =>
    set((state) => ({ roleByWorkspace: { ...state.roleByWorkspace, [workspaceId]: role } })),
}));