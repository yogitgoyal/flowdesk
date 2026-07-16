import { NextRequest, NextResponse } from 'next/server';
import { cookies } from "next/headers";
import { verifyRefreshToken, signAccessToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rl = checkRateLimit(`refresh:${ip}`, { windowMs: 15 * 60_000, max: 20 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many refresh attempts.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) {
      return new NextResponse(JSON.stringify({ error: "No refresh token" }), { status: 401 });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return new NextResponse(JSON.stringify({ error: "Invalid refresh token" }), { status: 401 });
    }

    const userId = decoded.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return new NextResponse(JSON.stringify({ error: "User not found" }), { status: 401 });
    }

    const accessToken = signAccessToken(user.id);

    cookieStore.set({
      name: 'access_token',
      value: accessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 2,
    });

    return new NextResponse(JSON.stringify({ accessToken }), { status: 200 });
  } catch (error) {
    console.error("Internal server error:", error);
    return new NextResponse(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}