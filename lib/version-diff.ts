export type TaskSnapshot = {
  title: string;
  description: string | null;
  priority: string;
  assigneeId: string | null;
  columnId: string;
  position: number;
};

export type DiffContext = {
  userNames: Record<string, string>;
  columnNames: Record<string, string>;
};

export function computeChanges(
  prev: TaskSnapshot | null,
  curr: TaskSnapshot,
  ctx: DiffContext
): string[] {
  if (!prev) return ["Task created"];

  const changes: string[] = [];

  if (prev.title !== curr.title) {
    changes.push(`Title: "${prev.title}" → "${curr.title}"`);
  }

  if (prev.description !== curr.description) {
    const prevDesc = prev.description ?? "(empty)";
    const currDesc = curr.description ?? "(empty)";
    if (prev.description === null) {
      changes.push(`Description: added "${currDesc}"`);
    } else if (curr.description === null) {
      changes.push(`Description: removed (was "${prevDesc}")`);
    } else {
      changes.push(`Description updated`);
    }
  }

  if (prev.priority !== curr.priority) {
    changes.push(`Priority: ${prev.priority} → ${curr.priority}`);
  }

  if (prev.assigneeId !== curr.assigneeId) {
    const prevName = prev.assigneeId
      ? (ctx.userNames[prev.assigneeId] ?? "Unknown")
      : "Unassigned";
    const currName = curr.assigneeId
      ? (ctx.userNames[curr.assigneeId] ?? "Unknown")
      : "Unassigned";
    changes.push(`Assignee: ${prevName} → ${currName}`);
  }

  if (prev.columnId !== curr.columnId) {
    const currName = ctx.columnNames[curr.columnId] ?? "?";
    changes.push(`Moved to ${currName}`);
  }

  return changes;
}