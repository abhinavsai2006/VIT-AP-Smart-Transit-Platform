import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.redirect(new URL('/icon.svg', 'http://localhost:3000'), 302);
}
