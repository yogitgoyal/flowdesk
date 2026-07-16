import { NextRequest, NextResponse } from 'next/server';
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("access_token");
    cookieStore.delete("refresh_token");
    return new NextResponse(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Internal server error:", error);
    return new NextResponse(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}