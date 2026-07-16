"use client";

import { useEffect, useState } from "react";
import {  ActivityAction } from "@/lib/mock-data";
import { formatActivityMessage, formatTimestamp } from "@/lib/activity-format";
import { apiFetch } from "@/lib/api-client";
export type PresenceEntry = {
  userId: string;
  userName: string;
  userAvatarColor: string;
  status: "online" | "viewing" | "editing" | "away";
};

export type PresenceInsights = {
  todayCount: number;
  yesterdayCount: number;
  percentChange: number;
  topContributors: {
    userId: string;
    name: string;
    avatarColor: string;
    count: number;
  }[];
};

const statusLabel: Record<PresenceEntry["status"], string> = {
  online: "Online",
  viewing: "Viewing",
  editing: "Editing",
  away: "Away",
};

const statusDotColor: Record<PresenceEntry["status"], string> = {
  online: "bg-teal-500",
  viewing: "bg-teal-500",
  editing: "bg-amber-500",
  away: "bg-gray-300",
};

export default function PresenceBar({
  entries,
  insights,
  insightsLoading,
  showActivityLine = false,
  currentProjectId,
}: {
  entries: PresenceEntry[];
  insights?: PresenceInsights | null;
  insightsLoading?: boolean;
  showActivityLine?: boolean;
  currentProjectId?: string | null;
}) {
  type LatestActivity = {
    action: ActivityAction;
    metadata: Record<string, string> | null;
    createdAt: string;
    user: { name: string; avatarColor: string } | null;
  };
  const [latestActivity, setLatestActivity] = useState<LatestActivity | null>(null);
  const onlineCount = entries.filter((e) => e.status !== "away").length;

  useEffect(() => {
    if (!showActivityLine || !currentProjectId) return;
    let cancelled = false;

    function pull() {
      apiFetch(`/api/projects/${currentProjectId}/activity?limit=1`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data?.activities?.[0]) {
            setLatestActivity(data.activities[0]);
          }
        })
        .catch(() => {});
    }

    pull();
    const i = setInterval(pull, 10000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, [showActivityLine, currentProjectId]);

  return (
    <div className="px-6 lg:px-10 pb-6 pt-4">
      <div className="bg-white border border-border rounded-2xl shadow-sm px-5 py-4">
        <div className="flex items-center justify-between gap-6 flex-wrap">

          {/* LEFT: online count + member list */}
          <div className="flex items-center gap-5 min-w-0 flex-1">
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold text-ink">
                {onlineCount} online now
              </span>
            </div>

            <div className="h-6 w-px bg-border hidden sm:block" />

            <div className="flex items-center gap-4 overflow-x-auto min-w-0">
              {entries.map((e) => (
                <div key={e.userId} className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm"
                      style={{ backgroundColor: e.userAvatarColor }}
                    >
                      {e.userName.charAt(0)}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${statusDotColor[e.status]}`}
                    />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-xs font-medium text-ink">
                      {e.userName.split(" ")[0]}
                    </span>
                    <span className="text-[10px] text-ink-secondary">
                      {statusLabel[e.status]}
                    </span>
                  </div>
                </div>
              ))}
              {entries.length === 0 && (
                <span className="text-xs text-ink-secondary/60">
                  No one else online
                </span>
              )}
            </div>
          </div>

          {/* RIGHT: insights + optional activity */}
          <div className="flex items-center gap-4 shrink-0 flex-wrap text-xs">
            <span className="text-[10px] font-bold text-ink-secondary tracking-wider uppercase hidden md:inline">
              Activity Insights
            </span>

            {insightsLoading ? (
              <div className="h-3.5 w-44 bg-border animate-pulse rounded" />
            ) : insights ? (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="text-amber-500">✨</span>
                  <span className="font-semibold text-ink">
                    {insights.todayCount}
                  </span>
                  <span className="text-ink-secondary">updates today</span>
                </span>

                <span
                  className={`flex items-center gap-0.5 font-semibold ${
                    insights.percentChange >= 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={insights.percentChange < 0 ? "rotate-180" : ""}
                  >
                    <line x1="7" y1="17" x2="17" y2="7" />
                    <polyline points="7 7 17 7 17 17" />
                  </svg>
                  {Math.abs(insights.percentChange)}% vs yesterday
                </span>

                {insights.topContributors.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-ink-secondary">Most active:</span>
                    <div className="flex -space-x-1">
                      {insights.topContributors.slice(0, 2).map((c) => (
                        <div
                          key={c.userId}
                          title={`${c.name} (${c.count} updates)`}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold border-2 border-white"
                          style={{ backgroundColor: c.avatarColor }}
                        >
                          {c.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {showActivityLine && latestActivity && (
              <>
                <span className="h-4 w-px bg-border hidden md:inline" />
                <div className="hidden lg:flex items-center gap-1.5 text-ink-secondary">
                  <span className="font-medium text-ink">
                    {latestActivity.user?.name ?? "Someone"}
                  </span>
                  <span>
                    {formatActivityMessage(
                      latestActivity.action,
                      latestActivity.metadata
                    )}
                  </span>
                  <span className="opacity-50">·</span>
                  <span>{formatTimestamp(latestActivity.createdAt)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}