import { create } from "zustand";

type Theme = "light" | "dark";
const STORAGE_KEY = "flowdesk-theme";

type ThemeStore = {
  theme: Theme;
  toggleTheme: () => void;
  syncFromDocument: () => void;
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  // Server-safe default. The client syncs to the real value after mount
  // via syncFromDocument(). Keeping this "light" on both server and client
  // avoids hydration mismatches.
  theme: "light",

  toggleTheme: () => {
    if (typeof window === "undefined") return;
    const next = get().theme === "dark" ? "light" : "dark";
    set({ theme: next });
    try {
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.classList.toggle("dark", next === "dark");
    } catch {}
  },

  // Reads the actual class on <html> (which the inline bootstrap script
  // set before React hydrated) and mirrors it into Zustand state so the
  // toggle button shows the correct label.
  syncFromDocument: () => {
    if (typeof document === "undefined") return;
    const isDark = document.documentElement.classList.contains("dark");
    set({ theme: isDark ? "dark" : "light" });
  },
}));