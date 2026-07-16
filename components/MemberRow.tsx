"use client";

import { Role, User } from "@/lib/mock-data";

const roleOptions: Role[] = ["ADMIN", "MEMBER"];

export default function MemberRow({
  user,
  role,
  onRoleChange,
  disabled,
}: {
  user: User | undefined;
  role: Role;
  onRoleChange: (role: Role) => void;
  disabled?: boolean;
}) {
  if (!user) return null;

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
          style={{ backgroundColor: user.avatarColor }}
        >
          {user.name.charAt(0)}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{user.name}</span>
          <span className="text-xs text-ink-secondary">{user.email}</span>
        </div>
      </div>

      <select
        value={role}
        disabled={disabled}
        onChange={(e) => onRoleChange(e.target.value as Role)}
        className="text-sm border border-border rounded-md px-2 py-1.5 bg-paper disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo"
      >
        {roleOptions.map((r) => (
          <option key={r} value={r}>
            {r.charAt(0) + r.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
    </div>
  );
}