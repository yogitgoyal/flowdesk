import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { comparePassword, signAccessToken, signRefreshToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

    let body: { email?: string; password?: string };
    try {
      const rawBody = await request.text();
      console.log('[login] raw body', rawBody);
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch (error) {
      console.error('[login] json parse failed', error);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { email, password } = body;

    const rl = checkRateLimit(`login:${ip}:${email?.toLowerCase?.() ?? 'unknown'}`, {
      windowMs: 15 * 60_000, // 15 min
      max: 5,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Invalid inputs' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);

    const cookieStore = await cookies();

    cookieStore.set({
      name: 'refresh_token',
      value: refreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    cookieStore.set({
      name: 'access_token',
      value: accessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 2,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;
    return NextResponse.json({ user: userWithoutPassword, accessToken }, { status: 200 });
  } catch (error) {
    console.error('[login] error', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}