import { NextResponse } from 'next/server';
import { getAllLiveLocations } from '@/lib/db/store';

// Latest reported position per trip. Only positions submitted by devices are returned;
// isLive is false when the last report is older than 2 minutes.
export async function GET() {
  try {
    const locations = await getAllLiveLocations();
    return NextResponse.json({ locations });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to retrieve locations';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}
