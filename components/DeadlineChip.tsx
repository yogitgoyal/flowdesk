"use client";

import { useEffect, useMemo, useState } from "react";

function getDueState(dueDate: string) {
  const due = new Date(dueDate);
  const now = new Date();
  const msUntilDue = due.getTime() - now.getTime();
  const diffDays = Math.floor(msUntilDue / 86400000);
  const overdue = msUntilDue < 0;
  const almostDue = !overdue && msUntilDue <= 3 * 86400000;

  const dateLabel = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  let relativeLabel: string | null = null;

  if (overdue) {
    const absDays = Math.ceil(Math.abs(msUntilDue) / 86400000);
    relativeLabel = absDays === 0 ? "today" : `${absDays}d overdue`;
  } else if (msUntilDue <= 24 * 3600_000) {
    const hours = Math.floor(msUntilDue / 3600_000);
    const minutes = Math.floor((msUntilDue % 3600_000) / 60000);
    relativeLabel = hours > 0 ? `${hours}h ${minutes}m left` : `${Math.max(minutes, 1)}m left`;
  } else if (diffDays === 0) {
    relativeLabel = "today";
  } else if (diffDays <= 3) {
    relativeLabel = `${diffDays}d left`;
  }

  return { dateLabel, relativeLabel, overdue, almostDue };
}

export default function DeadlineChip({ dueDate, className = "" }: { dueDate: string; className?: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((prev) => prev + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const due = useMemo(() => getDueState(dueDate), [dueDate, tick]);

  return (
    <span
      className={`text-xs flex items-center gap-1 font-medium ${className} ${
        due.overdue ? "text-danger" : due.almostDue ? "text-warning" : "text-ink-secondary"
      }`}
    >
      <span aria-hidden="true">📅</span>
      <span>
        {due.dateLabel}
        {due.relativeLabel && ` • ${due.relativeLabel}`}
      </span>
    </span>
  );
}
