"use client";

import { useThemeStore } from "@/lib/themeStore";

export default function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex items-center gap-2 text-sm border border-border rounded-md px-3 py-2 bg-surface hover:bg-surface-sunken transition"
    >
      {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}