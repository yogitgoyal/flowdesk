import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 64) || "export";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: { select: { id: true, name: true } },
        columns: {
          orderBy: { position: "asc" },
          include: {
            tasks: {
              orderBy: { position: "asc" },
              include: {
                assignee: {
                  select: { id: true, name: true, email: true, avatarColor: true },
                },
              },
            },
          },
        },
      },
    });

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const member = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspaceId: project.workspaceId },
    });
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const format = (request.nextUrl.searchParams.get("format") || "json").toLowerCase();
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${safeFilename(project.name)}-${stamp}`;

    if (format === "csv") {
      const header = [
        "Column", "Task", "Description", "Priority",
        "Assignee", "Due Date", "Created", "Last Updated",
      ];

      function formatDateForSpreadsheet(d: Date): string {
        // Deliberately NOT a plain ISO "YYYY-MM-DD" string — Excel
        // auto-detects that pattern as a date/number and can render it
        // as "####" in a narrow column. Including the weekday name makes
        // this unambiguously plain text, so it always displays in full
        // regardless of column width, with no manual resizing needed.
        return d.toLocaleDateString("en-US", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }

      const rows: string[][] = [header];
      for (const col of project.columns) {
        for (const t of col.tasks) {
          rows.push([
            col.name,
            t.title,
            t.description ?? "",
            t.priority,
            t.assignee?.name ?? "Unassigned",
            t.dueDate ? formatDateForSpreadsheet(t.dueDate) : "",
            formatDateForSpreadsheet(t.createdAt),
            formatDateForSpreadsheet(t.updatedAt),
          ]);
        }
      }

      const body = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }

    // JSON default
    const body = JSON.stringify({
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: { id: user.id, name: user.name, email: user.email },
      project: {
        id: project.id,
        name: project.name,
        workspace: project.workspace,
        columns: project.columns.map((c) => ({
          id: c.id,
          name: c.name,
          position: c.position,
          tasks: c.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            position: t.position,
            version: t.version,
            columnId: c.id,
            assignee: t.assignee,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
          })),
        })),
      },
    }, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}