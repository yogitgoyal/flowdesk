"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { apiFetch } from "@/lib/api-client";
type ApiNotification = {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const typeIcon: Record<string, string> = {
  assignment: "◎",
  mention: "@",
  activity: "•",
};

const typeColor: Record<string, string> = {
  assignment: "text-indigo",
  mention: "text-magenta",
  activity: "text-teal",
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        setLoading(true);

        const meRes = await apiFetch("/api/auth/me");
        if (!meRes.ok) return;
        const me = await meRes.json();

        const notifRes = await apiFetch("/api/notifications");
        if (notifRes.ok) {
          const data = await notifRes.json();
          if (!cancelled) setNotifications(data.notifications);
        }

        const socket = io({ path: "/socket.io" });
        socketRef.current = socket;

        const onConnect = () => socket.emit("join:user", me.id);
        socket.on("connect", onConnect);
        if (socket.connected) onConnect();

        socket.on("notification:created", (newNotification: ApiNotification) => {
          setNotifications((prev) => {
            if (prev.some((n) => n.id === newNotification.id)) return prev;
            return [newNotification, ...prev];
          });
        });
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitial();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
    };
  }, []);

  async function markAllRead() {
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      const res = await apiFetch("/api/notifications/mark-all-read", { method: "POST" });
      if (!res.ok) {
        setNotifications(previous);
      }
    } catch (err) {
      console.error("Failed to mark notifications read:", err);
      setNotifications(previous);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative text-ink-secondary hover:text-ink transition"
      >
        <span className="text-base">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-[0.35rem] text-[10px] font-semibold text-white ring-2 ring-surface">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-medium text-indigo hover:opacity-80 transition"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <p className="text-sm text-ink-secondary py-6 text-center">Loading…</p>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-ink-secondary">You&apos;re all caught up.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 transition ${
                      n.isRead ? "" : "bg-surface-sunken"
                    }`}
                  >
                    <span className={`shrink-0 mt-0.5 ${typeColor[n.type] ?? "text-ink-secondary"}`}>
                      {typeIcon[n.type] ?? "•"}
                    </span>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <p className="text-sm leading-snug">{n.message}</p>
                      <span className="text-xs text-ink-secondary">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    {!n.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo shrink-0 mt-1.5" aria-hidden="true" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}