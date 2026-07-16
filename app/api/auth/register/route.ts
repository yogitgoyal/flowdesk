import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hashPassword, signAccessToken, signRefreshToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const body = await request.json();
    const { email, password, name } = body;

    const rl = checkRateLimit(`register:${ip}:${email?.toLowerCase?.() ?? 'unknown'}`, {
      windowMs: 60 * 60_000, // 1 hour
      max: 3,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    if (!email || !password || !name || !email.includes('@') || password.length < 8) {
      return NextResponse.json({ error: 'Invalid inputs' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const avatarColors = ['#E8A33D', '#2E8B87', '#C74E79', '#4A5FD1'];
    const avatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const hashedPassword = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hashedPassword,
        avatarColor,
      },
    });

    const accessToken = signAccessToken(newUser.id);
    const refreshToken = signRefreshToken(newUser.id);

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
      maxAge: 60 * 15,
    });

    const { passwordHash, ...userWithoutPassword } = newUser;
    return NextResponse.json({ user: userWithoutPassword, accessToken }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}