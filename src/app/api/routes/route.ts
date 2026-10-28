import { NextRequest, NextResponse } from 'next/server';
import { getRoutes, createRoute } from '@/lib/db/store';

export async function GET() {
  try {
    const routes = await getRoutes();
    return NextResponse.json({ routes });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to retrieve routes';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      routeNumber,
      routeName,
      description,
      originStopId,
      destinationStopId,
      estimatedDurationMinutes,
      distanceKm,
      fareAmount,
      stops,
    } = body;

    if (!routeNumber || !routeName || !originStopId || !destinationStopId || !stops || stops.length < 2) {
      return NextResponse.json(
        { error: 'Route number, name, origin, destination, and at least 2 ordered stops are required.' },
        { status: 400 }
      );
    }

    const route = await createRoute({
      routeNumber: routeNumber.trim(),
      routeName,
      description: description || '',
      originStopId,
      destinationStopId,
      status: 'active',
      estimatedDurationMinutes: Number(estimatedDurationMinutes || 30),
      distanceKm: Number(distanceKm || 15),
      fareAmount: Number(fareAmount || 0),
      stops,
    });

    return NextResponse.json({ success: true, route });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to create route';
    return NextResponse.json({ error: err }, { status: 400 });
  }
}
