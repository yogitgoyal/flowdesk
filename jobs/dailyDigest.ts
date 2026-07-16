import { prisma } from "@/lib/prisma";

// Runs once a day (scheduled from server.ts via node-cron). For each
// workspace, summarises Activity from the last 24h and emails it to that
// workspace's ADMIN members only (FINAL_BLUEPRINT.md §7 — "Daily digest
// email: Admins only"). Reuses the existing Activity model — no new data
// modeling needed.

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[dailyDigest] RESEND_API_KEY not set — skipping email to ${to}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.DIGEST_FROM_EMAIL || "digest@flowdesk.dev",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[dailyDigest] Resend failed for ${to}: ${res.status} ${body}`);
  }
}

function renderDigestHtml(
  workspaceName: string,
  counts: Record<string, number>,
  totalEvents: number
): string {
  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([action, count]) => `<li>${action}: <strong>${count}</strong></li>`)
    .join("");

  return `
    <div style="font-family: sans-serif; color: #1A1D24;">
      <h2>${workspaceName} — last 24 hours</h2>
      <p>${totalEvents} activity event${totalEvents === 1 ? "" : "s"} recorded:</p>
      <ul>${rows || "<li>No activity in the last 24 hours.</li>"}</ul>
    </div>
  `;
}

export async function sendDailyDigest(): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const workspaces = await prisma.workspace.findMany({
    include: {
      members: {
        where: { role: "ADMIN" },
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });

  for (const workspace of workspaces) {
    if (workspace.members.length === 0) continue; // no admins to notify

    // Activity rows are scoped by projectId, so pull this workspace's project
    // ids first, then aggregate activity across them for the last 24h.
    const projects = await prisma.project.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);
    if (projectIds.length === 0) continue;

    const recentActivity = await prisma.activity.groupBy({
      by: ["action"],
      where: { projectId: { in: projectIds }, createdAt: { gte: since } },
      _count: true,
    });

    if (recentActivity.length === 0) continue; // nothing to report, skip the email

    const counts: Record<string, number> = {};
    let totalEvents = 0;
    for (const row of recentActivity) {
      counts[row.action] = row._count;
      totalEvents += row._count;
    }

    const html = renderDigestHtml(workspace.name, counts, totalEvents);

    for (const member of workspace.members) {
      await sendEmail(
        member.user.email,
        `${workspace.name}: ${totalEvents} update${totalEvents === 1 ? "" : "s"} today`,
        html
      );
    }
  }

  console.log(`[dailyDigest] Ran for ${workspaces.length} workspace(s) at ${new Date().toISOString()}`);
}
