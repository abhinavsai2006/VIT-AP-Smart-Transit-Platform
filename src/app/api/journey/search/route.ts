import { NextRequest, NextResponse } from 'next/server';
import { getRoutes, getTrips, getStops, getDisruptions } from '@/lib/db/store';
import { searchDirectJourneys } from '@/lib/journey-planner';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { originStopId, destinationStopId, travelDate, preferredTime, passengers } = body;

    if (!originStopId || !destinationStopId || !travelDate) {
      return NextResponse.json(
        { error: 'Origin stop, destination stop, and travel date are required.' },
        { status: 400 }
      );
    }

    if (originStopId === destinationStopId) {
      return NextResponse.json(
        { error: 'Origin stop and destination stop cannot be the same.' },
        { status: 400 }
      );
    }

    const [routes, trips, stopsList, disruptions] = await Promise.all([
      getRoutes(),
      getTrips(),
      getStops(),
      getDisruptions(),
    ]);

    const stopsMap = stopsList.reduce((acc, s) => {
      acc[s.id] = s;
      return acc;
    }, {} as Record<string, (typeof stopsList)[0]>);

    const results = searchDirectJourneys(routes, trips, stopsMap, disruptions, {
      originStopId,
      destinationStopId,
      travelDate,
      preferredTime,
      passengers: Number(passengers || 1),
    });

    return NextResponse.json({
      results,
      count: results.length,
      searchedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to search journeys';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}
