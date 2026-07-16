"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TaskCard from "@/components/TaskCard";
import CreateTaskModal from "@/components/CreateTaskModal";
import { Column, Task, User } from "@/lib/mock-data";
import { useState } from "react";

export default function BoardColumn({
  column,
  tasks,
  presentUsers,
  users,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isDrawerOpen,
  onTaskClick,
  onAddTask,
}: {
  column: Column;
  tasks: Task[];
  presentUsers: Record<string, string[]>;
  users: User[];
  isDrawerOpen: boolean;
  onTaskClick: (taskId: string) => void;
  onAddTask: (columnId: string, title: string, payload?: Partial<Task>) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { columnId: column.id, type: "column" },
  });

  const [isAdding, setIsAdding] = useState(false);

  return (
    <div className="flex flex-col gap-3 flex-1 basis-0 min-w-[280px] max-w-md transition-all duration-300 ease-out">
      {/* Column header — uppercase, tracking-wide, with count + underline */}
      <div className="flex flex-col gap-2 px-1 pb-1">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] font-semibold text-ink-secondary uppercase tracking-[0.08em]">
            {column.name}
          </h2>
          <span className="text-xs text-ink-secondary tabular-nums">{tasks.length}</span>
        </div>
        <div
          className="h-0.5 rounded-full"
          style={{
            backgroundColor:
              column.name.toLowerCase() === "done"
                ? "var(--color-teal)"
                : column.name.toLowerCase() === "in progress"
                ? "var(--color-amber)"
                : "var(--color-border)",
          }}
        />
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 rounded-3xl transition-colors p-1 min-h-[160px] ${
          isOver ? "bg-paper" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => {
            const presentUserIds = presentUsers[task.id] ?? [];
            const presentUserObjects = presentUserIds
              .map((id) => users.find((u) => u.id === id))
              .filter((u): u is User => u !== undefined);

            return (
              <TaskCard
                key={task.id}
                task={task}
                assignee={users.find((u) => u.id === task.assigneeId)}
                presentUsers={presentUserObjects}
                onClick={() => onTaskClick(task.id)}
              />
            );
          })}
        </SortableContext>

        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="group flex flex-col items-center gap-1 w-full px-3 py-4 mt-1 rounded-xl border border-dashed border-border text-ink-secondary hover:border-amber hover:text-amber bg-surface hover:bg-amber/5 transition"
          >
            <span className="inline-flex items-center gap-1.5 text-sm">
              <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-amber/15 text-amber text-xs leading-none">
                +
              </span>
              Add task
            </span>
            <span className="text-[10px] text-ink-secondary/70 group-hover:text-amber/70">
              Press N for quick add
            </span>
          </button>
        )}

        {isAdding && (
          <CreateTaskModal
            columnId={column.id}
            users={users}
            onClose={() => setIsAdding(false)}
            onAddTask={(colId, title, payload) => {
              onAddTask(colId, title, payload);
              setIsAdding(false);
            }}
          />
        )}
      </div>
    </div>
  );
}