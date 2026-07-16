"use client";

import { Task, User } from "@/lib/mock-data";
import PresenceLayer from "@/components/PresenceLayer";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const priorityColors: Record<Task["priority"], { dot: string; text: string }> = {
  LOW: { dot: "bg-slate-400", text: "text-slate-500 font-medium" },
  MEDIUM: { dot: "bg-amber-500", text: "text-amber-600 font-medium" },
  HIGH: { dot: "bg-violet-600", text: "text-violet-700 font-medium" },
  URGENT: { dot: "bg-rose-600", text: "text-rose-700 font-medium" },
};

import DeadlineChip from "@/components/DeadlineChip";

export default function TaskCard({
  task,
  assignee,
  presentUsers = [],
  isAssigneeOnline = false,
  onClick,
}: {
  task: Task;
  assignee: User | undefined;
  presentUsers?: User[];
  isAssigneeOnline?: boolean;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { columnId: task.columnId, task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const hasPresence = presentUsers.length > 0;
  const due = task.dueDate ? task.dueDate : null;

  const cardClasses = `group relative w-full text-left bg-surface border border-border rounded-3xl p-3 pl-7 transition flex flex-col gap-2 overflow-hidden cursor-grab active:cursor-grabbing touch-none ${isDragging ? 'shadow-lg opacity-90' : ''}`;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cardClasses}
    >
      {/* Drag handle visible on hover */}
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-ink-secondary/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor">
          <circle cx="2" cy="3" r="1.5" />
          <circle cx="2" cy="9" r="1.5" />
          <circle cx="2" cy="15" r="1.5" />
          <circle cx="10" cy="3" r="1.5" />
          <circle cx="10" cy="9" r="1.5" />
          <circle cx="10" cy="15" r="1.5" />
        </svg>
      </div>

      <PresenceLayer users={presentUsers} />

      <div className={`flex items-start justify-between gap-2 relative pointer-events-none ${hasPresence ? "mt-7" : ""}`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${priorityColors[task.priority].dot}`} />
          <span className={`text-[10px] uppercase tracking-wider font-semibold ${priorityColors[task.priority].text}`}>
            {task.priority}
          </span>
        </div>
      </div>

      <p className="text-sm font-medium leading-snug text-ink relative pointer-events-none">{task.title}</p>

      {task.description && (
        <p className="text-xs text-ink-secondary line-clamp-2 leading-relaxed relative pointer-events-none">
          {task.description}
        </p>
      )}

      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 relative pointer-events-none mt-0.5">
          {task.labels.map((label) => (
            <span
              key={label.id}
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border"
              style={{
                backgroundColor: `${label.color}15`,
                color: label.color,
                borderColor: `${label.color}30`,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 relative pointer-events-none mt-0.5">
        {due ? <DeadlineChip dueDate={due} /> : <span />}
        {assignee && (
          <div className="relative shrink-0">
            <div
              title={assignee.name}
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-medium ring-1 ring-black/5"
              style={{ backgroundColor: assignee.avatarColor }}
            >
              {assignee.name.charAt(0)}
            </div>
            {isAssigneeOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface bg-teal-500" />
            )}
          </div>
        )}
      </div>

      <span
        aria-hidden="true"
        className="absolute top-2 right-2 text-ink-secondary opacity-0 group-hover:opacity-100 transition text-lg leading-none pointer-events-none"
      >
        ⋯
      </span>
    </button>
  );
}