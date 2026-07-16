import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      CLOUDINARY_CLOUD_NAME: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
      CLOUDINARY_API_KEY: Boolean(process.env.CLOUDINARY_API_KEY),
      CLOUDINARY_API_SECRET: Boolean(process.env.CLOUDINARY_API_SECRET),
      NODE_ENV: process.env.NODE_ENV || null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
