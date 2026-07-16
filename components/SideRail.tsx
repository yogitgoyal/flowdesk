"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentRole } from "@/lib/useCurrentRole";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10l9-7 9 7v11a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V10z" />
      </svg>
    ),
  },
  {
    href: "/activity",
    label: "Activity",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h6l3-6 3 12 3-6h6" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19h16" />
        <path d="M5 12l4 4 5-8 3 6 3-4" />
      </svg>
    ),
  },
  {
    href: "/members",
    label: "Team",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function SideRail() {
  const pathname = usePathname();
  const { role } = useCurrentRole();
  const isAdmin = role === "ADMIN";
  const [collapsed, setCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; avatarColor: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      try {
        const res = await apiFetch("/api/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCurrentUser({ name: data.name, avatarColor: data.avatarColor });
      } catch {
        // ignore
      }
    }
    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeRoute = pathname?.split("?")[0] ?? "";

  return (
    <aside className={`flex flex-col border-r border-border bg-surface transition-all duration-200 ${collapsed ? "w-20" : "w-72"}`} aria-label="Primary navigation">
      <div className={`relative flex items-center ${collapsed ? "justify-between px-1 py-3" : "justify-between px-4 py-4"}`}>
        <Link href="/dashboard" className="flex items-center gap-2 text-ink">
          <span className={`inline-flex ${collapsed ? "h-9 w-9" : "h-11 w-11"} items-center justify-center rounded-2xl bg-signal text-white font-display text-sm font-semibold`}>
            FD
          </span>
          {!collapsed && <span className="text-sm font-semibold">FlowDesk</span>}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-paper text-ink-secondary transition hover:bg-paper/80"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
          </svg>
        </button>
      </div>

      <nav className="flex flex-col gap-2 px-2 py-2">
        {navItems.map((item) => {
          if (item.href === "/members" && !isAdmin) return null;
          const isActive = activeRoute === item.href || activeRoute.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-2xl px-3 py-3 transition ${
                isActive ? "bg-signal/10 text-signal" : "text-ink-secondary hover:bg-surface-sunken hover:text-ink"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-current/5 text-current">
                {item.icon}
              </span>
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto sticky bottom-0 bg-surface px-4 pb-4">
        <div className={`flex items-center gap-3 rounded-3xl border border-border bg-surface p-4 transition ${collapsed ? "justify-center" : ""}`}>
          <div className="relative">
            <div
              className="h-11 w-11 rounded-full border-2 border-surface bg-ink text-white flex items-center justify-center text-sm font-semibold"
              style={{ backgroundColor: currentUser?.avatarColor ?? "#94a3b8" }}
            >
              {currentUser?.name?.charAt(0) ?? "U"}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border border-surface bg-emerald-500" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{currentUser?.name ?? "You"}</p>
              <p className="text-xs text-ink-secondary flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Online
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
