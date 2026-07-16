import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessTokenEdge } from '@/lib/auth-edge';

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const decoded = await verifyAccessTokenEdge(accessToken);
  if (!decoded) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/activity/:path*',
    '/members/:path*',
    '/analytics/:path*',
    '/settings/:path*',
    '/workspaces/:path*',
  ],
};