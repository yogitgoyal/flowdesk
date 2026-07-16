import type { User } from '@prisma/client';
import { cookies } from 'next/headers';
import { verifyAccessToken } from './auth';
import { prisma } from './prisma';

export async function getCurrentUser(): Promise<Omit<User, 'passwordHash'> | null> {
  const cookieStore = await cookies();
  const accessTokenCookie = cookieStore.get('access_token');
  if (!accessTokenCookie) {
    return null;
  }
  const decodedToken = verifyAccessToken(accessTokenCookie.value);
  if (!decodedToken) {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: decodedToken.userId },
  });
  if (!user) {
    return null;
  }
  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}