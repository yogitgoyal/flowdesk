import { Workspace } from "@/lib/mock-data";

export default function WorkspaceCard({
  workspace,
  onClick,
}: {
  workspace: Workspace;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface border border-border rounded-lg p-5 hover:shadow-sm hover:border-indigo transition flex items-center justify-between"
    >
      <div className="flex flex-col gap-1">
        <span className="font-display text-lg font-semibold">{workspace.name}</span>
        <span className="text-sm text-ink-secondary">
          {workspace.memberCount} {workspace.memberCount === 1 ? "member" : "members"}
        </span>
      </div>
      <span className="text-ink-secondary text-xl">→</span>
    </button>
  );
}