import { create } from "zustand";

function setWorkspaceSelectionCookie(workspaceId: string | null) {
  if (typeof document === "undefined") return;

  if (workspaceId) {
    document.cookie = `selectedWorkspaceId=${encodeURIComponent(workspaceId)}; path=/; max-age=31536000; SameSite=Lax`;
  } else {
    document.cookie = "selectedWorkspaceId=; path=/; max-age=0; SameSite=Lax";
  }
}

type WorkspaceState = {
  selectedWorkspaceId: string | null;
  currentWorkspace: { id: string; name: string } | null;
  currentProject: { id: string; name: string } | null;
  setSelectedWorkspaceId: (id: string | null) => void;
  setCurrentWorkspace: (workspace: { id: string; name: string } | null) => void;
  setCurrentProject: (project: { id: string; name: string } | null) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedWorkspaceId: null,
  currentWorkspace: null,
  currentProject: null,
  setSelectedWorkspaceId: (id) => {
    set({ selectedWorkspaceId: id });
    setWorkspaceSelectionCookie(id);
  },
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  setCurrentProject: (project) => set({ currentProject: project }),
}));