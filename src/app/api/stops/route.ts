import { NextRequest, NextResponse } from 'next/server';
import { getStops, createStop } from '@/lib/db/store';

export async function GET() {
  try {
    const stops = await getStops();
    return NextResponse.json({ stops });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to retrieve stops';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, name, description, landmark, latitude, longitude, isAccessible } = body;

    if (!code || !name || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Stop code, name, latitude, and longitude are required.' },
        { status: 400 }
      );
    }

    const stop = await createStop({
      code: code.trim().toUpperCase(),
      name,
      description: description || '',
      landmark: landmark || '',
      latitude: Number(latitude),
      longitude: Number(longitude),
      isAccessible: Boolean(isAccessible),
    });

    return NextResponse.json({ success: true, stop });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to create stop';
    return NextResponse.json({ error: err }, { status: 400 });
  }
}
