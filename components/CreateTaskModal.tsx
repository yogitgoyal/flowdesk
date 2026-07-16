"use client";

import { useState, useEffect } from "react";
import { User, Task } from "@/lib/mock-data";

export default function CreateTaskModal({
  columnId,
  users,
  onClose,
  onAddTask,
}: {
  columnId: string;
  users: User[];
  onClose: () => void;
  onAddTask: (
    columnId: string,
    title: string,
    payload: {
      assigneeId?: string | null;
      priority?: Task["priority"];
      dueDate?: string | null;
      dueDateLocked?: boolean;
    }
  ) => void;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [priority, setPriority] = useState<Task["priority"]>("MEDIUM");
  const [dueDate, setDueDate] = useState<string>("");
  const [dueDateLocked, setDueDateLocked] = useState(false);

  // Auto-fill logic
  useEffect(() => {
    if (assigneeId && !dueDateLocked) {
      const today = new Date();
      let daysToAdd = 7; // MEDIUM
      if (priority === "URGENT") daysToAdd = 1;
      else if (priority === "HIGH") daysToAdd = 3;
      else if (priority === "LOW") daysToAdd = 14;

      const newDate = new Date(today);
      newDate.setDate(newDate.getDate() + daysToAdd);
      
      // format as YYYY-MM-DD for input type="date"
      const yyyy = newDate.getFullYear();
      const mm = String(newDate.getMonth() + 1).padStart(2, '0');
      const dd = String(newDate.getDate()).padStart(2, '0');
      
      setDueDate(`${yyyy}-${mm}-${dd}`);
    }
  }, [assigneeId, priority, dueDateLocked]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    onAddTask(columnId, title.trim(), {
      assigneeId: assigneeId || null,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      dueDateLocked,
    });
    onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-ink/20 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-surface rounded-2xl w-full max-w-md shadow-2xl border border-border overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Add New Task</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-paper text-ink-secondary hover:text-ink transition font-bold"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
                Title <span className="text-danger">*</span>
              </label>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full text-sm bg-paper border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo transition-shadow"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
                  Assignee
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full text-sm bg-paper border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo transition-shadow"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Task["priority"])}
                  className="w-full text-sm bg-paper border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo transition-shadow"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setDueDateLocked(true);
                }}
                className="w-full text-sm bg-paper border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo transition-shadow"
              />
              <p className="text-[10px] text-ink-secondary">
                Auto-set based on priority. Adjust to override.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-ink-secondary hover:text-ink transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="px-4 py-2 text-sm font-medium bg-indigo text-white rounded-lg hover:bg-indigo/90 transition disabled:opacity-50"
              >
                Create Task
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
