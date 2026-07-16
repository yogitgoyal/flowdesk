import { NextResponse } from "next/server";
import { getActiveMembers } from "@/lib/presenceStore";

export async function GET() {
  const members = getActiveMembers();
  return NextResponse.json({ members }, { status: 200 });
}
