"use client";

import { User } from "@/lib/mock-data";

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

export default function PresenceLayer({ users }: { users: User[] }) {
  if (users.length === 0) return null;

  const showWash = users.length >= 2;
  const gradientColors = users.slice(0, 3).map((u: User) => hexToRgba(u.avatarColor, 0.12));
  
  let gradientStyle: React.CSSProperties = {};
  if (showWash) {
    if (gradientColors.length === 2) {
      gradientStyle = { backgroundImage: `linear-gradient(to bottom right, ${gradientColors[0]}, ${gradientColors[1]})` };
    } else if (gradientColors.length >= 3) {
      gradientStyle = { backgroundImage: `linear-gradient(to bottom right, ${gradientColors[0]}, ${gradientColors[1]}, ${gradientColors[2]})` };
    }
  }

  return (
    <>
      {showWash && (
        <div 
          className="absolute inset-0 rounded-xl pointer-events-none" 
          style={gradientStyle}
        />
      )}

      {/* Overlapping avatar pills with green presence dots */}
      <div className="absolute top-2 left-2 flex items-center -space-x-2 pointer-events-none z-10">
        {users.slice(0, 4).map((u) => (
          <div key={u.id} className="relative">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-medium ring-2 ring-surface shadow-sm"
              style={{ backgroundColor: u.avatarColor }}
            >
              {u.name.charAt(0)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-surface bg-green-500" />
          </div>
        ))}
      </div>
    </>
  );
}