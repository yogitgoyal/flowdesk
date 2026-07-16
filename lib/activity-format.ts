import { ActivityAction } from "@/lib/mock-data";

export function formatActivityMessage(
  action: ActivityAction,
  metadata: Record<string, string> | null
): string {
  const title = metadata?.title ?? "a task";
  switch (action) {
    case "task.created":
      return `created "${title}"`;
    case "task.moved":
      return `moved "${title}" from ${metadata?.from ?? "?"} to ${metadata?.to ?? "?"}`;
    case "task.assigned":
      return `assigned "${title}" to ${metadata?.assignee ?? "someone"}`;
    case "task.updated":
      return `updated the ${metadata?.field ?? "task"} on "${title}"`;
    case "task.deleted":
      return `deleted "${title}"`;
    default:
      return `updated "${title}"`;
  }
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
}