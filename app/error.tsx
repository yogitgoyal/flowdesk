"use client";

import { useEffect } from "react";

// NEW for Week 5 — Week 4 had no error boundary at all, so any unhandled
// render error showed Next.js's raw dev overlay / a blank white screen in
// prod. This is standard Next.js App Router convention (not project-specific
// logic), so it's given fully working rather than as a TODO.

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled UI error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-6">
      <div className="max-w-sm text-center flex flex-col items-center gap-4">
        <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-ink-secondary">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-indigo text-white text-sm font-medium hover:opacity-90 active:scale-[0.98] transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
