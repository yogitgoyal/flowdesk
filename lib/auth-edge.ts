import { jwtVerify } from 'jose';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

if (!JWT_ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET must be set in .env');
}

const encodedSecret = new TextEncoder().encode(JWT_ACCESS_SECRET);

export async function verifyAccessTokenEdge(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret);
    if (typeof payload.userId !== 'string') return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}