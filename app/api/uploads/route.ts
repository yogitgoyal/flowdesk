import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCloudinaryConfig, signUploadParams } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { getMemberRole, canModifyTask } from "@/lib/roles";

// This route's job: verify the user is authenticated AND authorized to
// attach a file to the specific task being uploaded for, then hand back a
// signature so the client can upload directly to Cloudinary (file bytes
// never touch this Next.js server -- see lib/cloudinary.ts for the flow).
// Requires ?taskId= so we can check ownership before issuing a signature --
// otherwise any authenticated user in any workspace could get a valid
// signature and upload to this Cloudinary account.

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const project = await prisma.project.findUnique({ where: { id: task.projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const role = await getMemberRole(user.id, project.workspaceId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!canModifyTask(user.id, task, role)) {
    return NextResponse.json(
      { error: "You can only attach files to tasks assigned to you" },
      { status: 403 }
    );
  }

  try {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = { timestamp, folder: "flowdesk-uploads" };
    const signature = signUploadParams(paramsToSign, apiSecret);

    return NextResponse.json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder: paramsToSign.folder,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}