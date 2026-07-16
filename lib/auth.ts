import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in .env'
  );
}

// Re-assign to new consts so TypeScript treats these as definitely `string`
// from this point on (the guard above already guarantees it at runtime).
const ACCESS_SECRET: string = JWT_ACCESS_SECRET;
const REFRESH_SECRET: string = JWT_REFRESH_SECRET;

export function signAccessToken(userId: string): string {
  return jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: '2h' });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as unknown as { userId: string };
    return decoded;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as unknown as { userId: string };
    return decoded;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}