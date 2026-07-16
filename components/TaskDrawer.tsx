"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { Task, User, ActivityAction } from "@/lib/mock-data";
import { formatActivityMessage, formatTimestamp } from "@/lib/activity-format";
import DeadlineChip from "@/components/DeadlineChip";

type Tab = "description" | "activity" | "version";

const priorityColor: Record<Task["priority"], string> = {
  LOW: "text-ink-secondary",
  MEDIUM: "text-amber",
  HIGH: "text-warning",
  URGENT: "text-danger",
};

type TaskUpdates = Partial<{
  title: string;
  description: string | null;
  priority: Task["priority"];
  assigneeId: string | null;
  attachmentUrl: string | null;
}>;

type ApiActivity = {
  id: string;
  taskId: string | null;
  userId: string;
  action: ActivityAction;
  metadata: Record<string, string> | null;
  createdAt: string;
  user: { id: string; name: string; avatarColor: string } | null;
};

type ApiVersion = {
  version: number;
  editedBy: string;
  editedAt: string;
  user: { name: string; avatarColor: string } | null;
  changes: string[];
};

export default function TaskDrawer({
  task,
  users,
  presentUsers = [],
  onClose,
  onDelete,
  onUpdate,
  titleLockedBy,
  descriptionLockedBy,
  onFieldFocus,
  onFieldBlur,
}: {
  task: Task | null;
  users: User[];
  presentUsers?: User[];
  onClose: () => void;
  onDelete: (taskId: string) => void;
  onUpdate: (taskId: string, updates: TaskUpdates) => void;
  titleLockedBy: User | null;
  descriptionLockedBy: User | null;
  onFieldFocus: (field: string) => void;
  onFieldBlur: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("description");
  const [activities, setActivities] = useState<ApiActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState<Task["priority"]>("MEDIUM");
  const [editAssigneeId, setEditAssigneeId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);

  function clearAttachment() {
    if (!task) return;
    saveField({ attachmentUrl: null });
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewName(null);
    setPreviewType(null);
    setUploadError(null);
  }

  function getUploadErrorMessage(payload: unknown) {
    if (!payload || typeof payload !== "object") return "Upload failed. Please try again.";
    const obj = payload as { error?: { message?: string }; message?: string };
    if (obj.error?.message) return obj.error.message;
    if (obj.message) return String(obj.message);
    return "Upload failed. Please try again.";
  }

  async function handleFileUpload(file: File) {
    if (!task) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File is too large. Please upload a file smaller than 10MB.");
      return;
    }

    const fileType = file.type || "application/octet-stream";
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
    setPreviewName(file.name);
    setPreviewType(fileType);
    setUploading(true);
    setUploadError(null);

    try {
      const sigRes = await apiFetch(`/api/uploads?taskId=${task.id}`);
      if (!sigRes.ok) {
        const payload = await sigRes.json().catch(() => null);
        throw new Error(getUploadErrorMessage(payload) || "Could not get upload signature.");
      }

      const { signature, timestamp, apiKey, cloudName, folder } = await sigRes.json();
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", apiKey);
      form.append("timestamp", String(timestamp));
      form.append("signature", signature);
      form.append("folder", folder);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: "POST",
        body: form,
      });

      const uploaded = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(getUploadErrorMessage(uploaded) || "Upload to Cloudinary failed.");
      }

      saveField({ attachmentUrl: uploaded.secure_url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewName(null);
      setPreviewType(null);
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (!previewUrl) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (task) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: resets local edit state when the selected task changes
      setEditTitle(task.title);
      setEditDescription(task.description ?? "");
      setEditPriority(task.priority);
      setEditAssigneeId(task.assigneeId ?? "");
      setIsEditingTitle(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally scoped to task.id, not the whole task object, to avoid refetching on every parent re-render
  }, [task?.id]);

  useEffect(() => {
    if (!task) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clears activity list when drawer closes/task changes
      setActivities([]);
      return;
    }
    let cancelled = false;
    setActivityLoading(true);
    apiFetch(`/api/tasks/${task.id}/activity`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!cancelled) setActivities(data.activities);
      })
      .catch((err) => {
        console.error("Failed to load activity:", err);
        if (!cancelled) setActivities([]);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally scoped to task.id, not the whole task object, to avoid refetching on every parent re-render
  }, [task?.id]);

  useEffect(() => {
    if (!task) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clears version list when drawer closes/task changes
      setVersions([]);
      return;
    }
    let cancelled = false;
    setVersionsLoading(true);
    apiFetch(`/api/tasks/${task.id}/versions`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!cancelled) setVersions(data.versions);
      })
      .catch((err) => {
        console.error("Failed to load versions:", err);
        if (!cancelled) setVersions([]);
      })
      .finally(() => {
        if (!cancelled) setVersionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally scoped to task.id, not the whole task object, to avoid refetching on every parent re-render
  }, [task?.id]);

  if (!task) return null;

  function saveField(updates: TaskUpdates) {
    if (!task) return;
    onUpdate(task.id, updates);
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-ink/10 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="fixed top-0 right-0 h-full w-[420px] bg-surface border-l border-border z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex -space-x-1.5">
            {presentUsers.slice(0, 4).map((u) => (
              <div
                key={u.id}
                title={`${u.name} is viewing this task`}
                className="w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center text-white text-[10px] font-semibold"
                style={{ backgroundColor: u.avatarColor }}
              >
                {u.name.charAt(0)}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onDelete(task.id)}
              aria-label="Delete task"
              title={`Delete task ${task.id}`}
              className="text-xs text-danger hover:underline transition"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-ink-secondary hover:text-ink transition"
            >
              X
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-border flex flex-col gap-4">
          {isEditingTitle ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onFocus={() => onFieldFocus("title")}
              onBlur={() => {
                setIsEditingTitle(false);
                onFieldBlur();
                const trimmed = editTitle.trim();
                if (trimmed && trimmed !== task.title) {
                  saveField({ title: trimmed });
                } else {
                  setEditTitle(task.title);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setEditTitle(task.title);
                  setIsEditingTitle(false);
                }
              }}
              className="font-display text-xl font-semibold bg-transparent border-b border-indigo focus:outline-none w-full"
            />
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className={
                  titleLockedBy
                    ? "font-display text-xl font-semibold cursor-not-allowed text-ink-secondary"
                    : "font-display text-xl font-semibold cursor-text"
                }
                onClick={() => {
                  if (!titleLockedBy) setIsEditingTitle(true);
                }}
                title={titleLockedBy ? "" : "Click to edit"}
              >
                {task.title}
              </h2>
              {titleLockedBy && (
                <span className="text-xs text-ink-secondary italic">
                  {titleLockedBy.name} is editing this field
                </span>
              )}
            </div>
          )}

          <div className="flex gap-8">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-secondary uppercase tracking-wide">Priority</span>
              <select
                value={editPriority}
                onChange={(e) => {
                  const newPriority = e.target.value as Task["priority"];
                  setEditPriority(newPriority);
                  saveField({ priority: newPriority });
                }}
                className={`text-sm font-medium bg-transparent border border-border rounded px-2 py-1 ${priorityColor[editPriority]}`}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-secondary uppercase tracking-wide">Assignee</span>
              <select
                value={editAssigneeId}
                onChange={(e) => {
                  const newAssigneeId = e.target.value;
                  setEditAssigneeId(newAssigneeId);
                  saveField({ assigneeId: newAssigneeId === "" ? null : newAssigneeId });
                }}
                className="text-sm bg-transparent border border-border rounded px-2 py-1"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-secondary uppercase tracking-wide">Due</span>
              {task.dueDate ? <DeadlineChip dueDate={task.dueDate} /> : <span className="text-sm text-ink-secondary">No due date</span>}
            </div>
          </div>
        </div>

        <div className="flex border-b border-border px-6">
          {([
            { key: "description", label: "Description" },
            { key: "activity",    label: "Activity" },
            { key: "version",     label: `Version History (${versions.length})` },
          ] as { key: Tab; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 mr-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-indigo text-ink"
                  : "border-transparent text-ink-secondary hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === "description" && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-secondary uppercase tracking-wide">Description</span>       

                {descriptionLockedBy && (
                  <span className="text-xs text-ink-secondary italic">
                    {descriptionLockedBy.name} is editing this field
                  </span>
                )}
              </div>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                onFocus={() => onFieldFocus("description")}
                onBlur={() => {
                  onFieldBlur();
                  const current = task.description ?? "";
                  if (editDescription !== current) {
                    saveField({ description: editDescription.trim() === "" ? null : editDescription });       
                  }
                }}
                disabled={!!descriptionLockedBy}
                placeholder="No description yet. Click to add one."
                className="text-sm whitespace-pre-wrap bg-transparent border border-border rounded px-3 py-2 min-h-[120px] focus:outline-none focus:border-indigo disabled:opacity-50 disabled:cursor-not-allowed"
              />

              <div className="flex flex-col gap-3 mt-4">
                <span className="text-xs text-ink-secondary uppercase tracking-wide">Attachment</span>

                <div className="flex flex-col gap-2 rounded border border-border p-3 bg-surface">
                  {previewUrl ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center shrink-0 w-16 h-16 rounded border border-border bg-white overflow-hidden">
                        {previewType?.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element -- local blob preview URL from a freshly selected file; not eligible for next/image optimization
                          <img src={previewUrl} alt={previewName ?? "Attachment preview"} className="object-contain w-full h-full" />
                        ) : (
                          <div className="text-xs text-ink-secondary text-center px-1">
                            {previewName ?? "File preview"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{previewName}</p>
                        <p className="text-xs text-ink-secondary truncate">{previewType}</p>
                      </div>
                    </div>
                  ) : task.attachmentUrl ? (
                    <a
                      href={task.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo hover:underline truncate"
                    >
                      View attachment
                    </a>
                  ) : (
                    <p className="text-xs text-ink-secondary">No attachment yet.</p>
                  )}

                  <div className="flex flex-wrap gap-2 items-center">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-indigo cursor-pointer w-fit">
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                          e.target.value = "";
                        }}
                      />
                      <span className="border border-border rounded px-2.5 py-1.5 hover:bg-paper transition">
                        {uploading ? "Uploading..." : task.attachmentUrl ? "Replace file" : "Upload file"}
                      </span>
                    </label>

                    {(task.attachmentUrl || previewUrl) && !uploading ? (
                      <button
                        type="button"
                        onClick={clearAttachment}
                        className="text-xs text-danger underline hover:text-danger-dark"
                      >
                        Clear attachment
                      </button>
                    ) : null}
                  </div>
                </div>

                {uploadError && <p className="text-xs text-danger">{uploadError}</p>}
              </div>
            </div>
          )}

          {activeTab === "activity" && (
            <div className="flex flex-col gap-4">
              {activityLoading ? (
                <p className="text-sm text-ink-secondary">Loading activity...</p>
              ) : activities.length === 0 ? (
                <p className="text-sm text-ink-secondary">No activity yet.</p>
              ) : (
                activities.map((a) => {
                  const user = a.user;
                  return (
                    <div key={a.id} className="flex gap-3">
                      {user ? (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                          style={{ backgroundColor: user.avatarColor }}
                        >
                          {user.name.charAt(0)}
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-border shrink-0" />
                      )}
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{user?.name ?? "Someone"}</span>{" "}
                          <span className="text-ink-secondary">
                            {formatActivityMessage(a.action, a.metadata)}
                          </span>
                        </p>
                        <span className="text-xs text-ink-secondary">
                          {formatTimestamp(a.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "version" && (
            <div className="flex flex-col gap-4">
              {versionsLoading ? (
                <p className="text-sm text-ink-secondary">Loading version history...</p>
              ) : versions.length === 0 ? (
                <p className="text-sm text-ink-secondary">No version history yet.</p>
              ) : (
                versions.map((v) => {
                  const user = v.user;
                  return (
                    <div key={v.version} className="flex gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-7 h-7 rounded-full bg-paper border border-border flex items-center justify-center text-xs font-mono shrink-0">
                          v{v.version}
                        </div>
                        <div className="w-px flex-1 bg-border" />
                      </div>
                      <div className="flex flex-col gap-1 pb-4 min-w-0">
                        <div className="flex items-center gap-2">
                          {user ? (
                            <div
                              className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-medium"
                              style={{ backgroundColor: user.avatarColor }}
                            >
                              {user.name.charAt(0)}
                            </div>
                          ) : null}
                          <span className="text-sm font-medium">{user?.name ?? v.editedBy}</span>
                          <span className="text-xs text-ink-secondary">
                            {formatTimestamp(v.editedAt)}
                          </span>
                        </div>
                        <ul className="flex flex-col gap-0.5 text-sm text-ink-secondary">
                          {v.changes.map((change, j) => (
                            <li key={j} className="font-mono text-xs">- {change}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}