export type PresenceMember = {
  id: string;
  name: string;
  color: string;
  initials: string;
  state: "Online" | "Editing" | "Viewing" | "Away";
  lastSeen: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __flowdeskPresenceStore: Map<string, PresenceMember> | undefined;
}

if (!globalThis.__flowdeskPresenceStore) {
  globalThis.__flowdeskPresenceStore = new Map();
}

const store = globalThis.__flowdeskPresenceStore;

export function updateHeartbeat(user: { id: string; name: string; color: string }, state: PresenceMember["state"] = "Online") {
  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  store.set(user.id, {
    id: user.id,
    name: user.name,
    color: user.color,
    initials,
    state,
    lastSeen: Date.now(),
  });
}

export function getActiveMembers(): PresenceMember[] {
  const now = Date.now();
  const list: PresenceMember[] = [];
  store.forEach((member) => {
    if (now - member.lastSeen <= 60000) {
      list.push(member);
    }
  });
  return list;
}
