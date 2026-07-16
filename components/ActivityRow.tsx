"use client";

import { ActivityAction } from "@/lib/mock-data";

type ActivityTask = {
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  assignee: {
    id: string;
    name: string;
    avatarColor: string;
  } | null;
};

type ActivityUser = {
  id: string;
  name: string;
  avatarColor: string;
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3
    ? h.split("").map((c: string) => c + c).join("")
    : h.padEnd(6, "0");
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export type ApiActivityRow = {
  id: string;
  taskId: string | null;
  projectId: string;
  userId: string;
  action: ActivityAction;
  metadata: Record<string, string> | null;
  createdAt: string;
  user: ActivityUser | null;
  task: ActivityTask | null;
};

export default function ActivityRow({
  activity,
  isUserOnline,
  taskViewers,
  onOpenTask,
}: {
  activity: ApiActivityRow;
  isUserOnline: boolean;
  taskViewers: { id: string; name: string; avatarColor: string }[];
  onOpenTask: (taskId: string) => void;
}) {
  const { user, task, action } = activity;

  // Format action text
  let actionVerb = "updated";
  if (action === "task.created") actionVerb = "created";
  if (action === "task.moved") actionVerb = "moved";
  if (action === "task.assigned") actionVerb = "assigned";
  if (action === "task.deleted") actionVerb = "deleted";

  // Time format
  const date = new Date(activity.createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  let timeString = date.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  let timeLabel = `${timeString}`;
  if (diffDays === 0 && now.getDate() === date.getDate()) {
    timeLabel = `Today, ${timeString}`;
  } else if (diffDays === 1 || (diffDays === 0 && now.getDate() !== date.getDate())) {
    timeLabel = `Yesterday, ${timeString}`;
  } else {
    timeLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  // Priority color
  const priorityMap = {
    URGENT: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
    HIGH: { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
    MEDIUM: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
    LOW: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  };
  const prio = task ? priorityMap[task.priority] : null;

  // Due date format
  let dueLabel = null;
  let dueColor = "text-gray-500";
  if (task?.dueDate) {
    const due = new Date(task.dueDate);
    dueLabel = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) {
      dueColor = "text-red-500";
      dueLabel += ` • ${Math.abs(diff)}d overdue`;
    } else if (diff <= 3) {
      dueColor = "text-amber-600";
      dueLabel += ` • ${diff}d left`;
    }
  }

  // Multi-viewer background logic
  const isMultiViewer = taskViewers.length >= 2;
  const gradientColors = taskViewers
    .slice(0, 3)
    .map((u: { id: string; name: string; avatarColor: string }) => hexToRgba(u.avatarColor, 0.12));
  let gradientStyle: React.CSSProperties = {};
  if (isMultiViewer) {
    if (gradientColors.length === 2) {
      gradientStyle = { backgroundImage: `linear-gradient(to right, ${gradientColors[0]}, ${gradientColors[1]})` };
    } else {
      gradientStyle = { backgroundImage: `linear-gradient(to right, ${gradientColors[0]}, ${gradientColors[1]}, ${gradientColors[2]})` };
    }
  }

  return (
    <div
      className={`relative flex items-center justify-between w-full px-6 py-5 min-h-[80px] transition-colors group hover:brightness-95 ${
        isMultiViewer ? '' : 'bg-surface hover:bg-gray-50'
      }`}
      style={gradientStyle}
    >
      <div className="flex items-center min-w-0 flex-1">
        {/* Col 1 - Avatar */}
        <div className="relative shrink-0 w-10 h-10 mr-5">
          {user ? (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-sm"
              style={{ backgroundColor: user.avatarColor }}
            >
              {user.name.charAt(0)}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-border" />
          )}
          {isUserOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-green-500" />
          )}
        </div>

        {/* Col 2 - Action Text */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 mr-5 truncate">
          <span className="font-semibold text-gray-900 truncate shrink-0 max-w-[200px]">{user?.name ?? "Someone"}</span>
          <span className="text-gray-600 shrink-0">{actionVerb}</span>
          <span
            className="italic text-gray-700 truncate cursor-pointer hover:text-indigo transition-colors"
            onClick={() => activity.taskId && onOpenTask(activity.taskId)}
          >
            {task?.title ?? activity.metadata?.title ?? "a task"}
          </span>
        </div>

        {/* Col 3 - Timestamp */}
        <div className="shrink-0 flex items-center gap-1.5 w-32 mr-5">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          <span className="text-xs text-gray-500 font-medium truncate">{timeLabel}</span>
        </div>

        {/* Col 4 - Priority */}
        <div className="shrink-0 w-28 mr-5 flex items-center">
          {prio && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${prio.bg} ${prio.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
              {task?.priority}
            </span>
          )}
        </div>

        {/* Col 5 - Due Date */}
        <div className={`shrink-0 w-40 mr-5 text-xs font-medium ${dueColor} truncate flex items-center gap-1.5`}>
          {dueLabel && (
            <>
              <span>📅</span>
              <span className="truncate">{dueLabel}</span>
            </>
          )}
        </div>

        {/* Col 6 - Assignee */}
        <div className="shrink-0 w-12 mr-2 flex items-center">
          {task?.assignee && (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold border-2 border-surface shadow-sm"
              style={{ backgroundColor: task.assignee.avatarColor }}
              title={task.assignee.name}
            >
              {task.assignee.name.charAt(0)}
            </div>
          )}
        </div>
      </div>

      {/* Multi-viewer presence cluster & Open Icon */}
      <div className="shrink-0 flex items-center gap-4">
        {isMultiViewer && (
          <div className="flex -space-x-2">
            {taskViewers.slice(0, 3).map((v) => (
              <div key={v.id} className="relative">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold border-2 border-surface shadow-sm"
                  style={{ backgroundColor: v.avatarColor }}
                  title={v.name}
                >
                  {v.name.charAt(0)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface bg-green-500" />
              </div>
            ))}
            {taskViewers.length > 3 && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 bg-gray-100 border-2 border-surface text-[10px] font-semibold z-10">
                +{taskViewers.length - 3}
              </div>
            )}
          </div>
        )}

        {/* Col 7 - Open Icon */}
        <button
          onClick={() => activity.taskId && onOpenTask(activity.taskId)}
          title="Open task"
          aria-label="Open task"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          disabled={!activity.taskId}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}
