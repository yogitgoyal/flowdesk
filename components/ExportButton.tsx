"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "@/lib/workspaceStore";
import { apiFetch } from "@/lib/api-client";
type Format = "json" | "csv";

export default function ExportButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const project = useWorkspaceStore((s) => s.currentProject);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleExport(format: Format) {
    if (!project) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/projects/${project.id}/export?format=${format}`);
      if (!res.ok) {
        const body = await res.text();
        console.error("Export failed:", res.status, body);
        setErr(`Export failed (${res.status}): ${body.slice(0, 120)}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      a.download = match?.[1] ?? `${project.name.replace(/\W+/g, "_")}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  if (err && !project) {
    return (
      <button
        type="button"
        disabled
        title={err}
        className="text-sm text-ink-secondary opacity-50 cursor-not-allowed"
      >
        Export
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy || !project}
        className="text-sm text-ink-secondary hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {busy ? "Exporting…" : project ? "Export" : "…"}
      </button>
      {open && project && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-surface border border-border rounded-md shadow-lg z-50 overflow-hidden">
          <button
            type="button"
            onClick={() => handleExport("json")}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-paper transition"
          >
            Download as JSON
          </button>
          <button
            type="button"
            onClick={() => handleExport("csv")}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-paper transition"
          >
            Download as CSV
          </button>
        </div>
      )}
      {err && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-danger text-danger text-xs rounded-md p-2 z-50">
          {err}
        </div>
      )}
    </div>
  );
}