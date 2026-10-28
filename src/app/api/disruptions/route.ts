import { NextRequest, NextResponse } from 'next/server';
import { getDisruptions, createDisruption } from '@/lib/db/store';

export async function GET() {
  try {
    const disruptions = await getDisruptions();
    return NextResponse.json({ disruptions });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to retrieve disruptions';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, message, severity, routeId, stopId, affectedRoutes, startTime, endTime } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Disruption title and message are required.' }, { status: 400 });
    }

    const disruption = await createDisruption({
      title,
      message,
      severity: severity || 'warning',
      routeId,
      stopId,
      affectedRoutes: affectedRoutes || [],
      startTime: startTime || new Date().toISOString(),
      endTime: endTime || new Date(Date.now() + 86400000 * 3).toISOString(),
      status: 'active',
    });

    return NextResponse.json({ success: true, disruption });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to publish disruption alert';
    return NextResponse.json({ error: err }, { status: 400 });
  }
}
