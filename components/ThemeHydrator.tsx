"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/lib/themeStore";

// Invisible component that runs once on mount to sync the Zustand store
// with whatever the inline bootstrap script put on <html>. Returns null
// so it doesn't render anything.
export default function ThemeHydrator() {
  useEffect(() => {
    useThemeStore.getState().syncFromDocument();
  }, []);
  return null;
}