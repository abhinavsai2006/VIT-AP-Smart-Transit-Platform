import { NextRequest, NextResponse } from 'next/server';
import { getTrips, createTrip } from '@/lib/db/store';

export async function GET() {
  try {
    const trips = await getTrips();
    return NextResponse.json({ trips });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to retrieve trips';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      routeId,
      busId,
      driverId,
      conductorId,
      travelDate,
      departureTime,
      arrivalTime,
      operationalNotes,
    } = body;

    if (!routeId || !busId || !driverId || !conductorId || !travelDate || !departureTime || !arrivalTime) {
      return NextResponse.json(
        { error: 'All trip parameters are required: route, bus, driver, conductor, travelDate, departureTime, arrivalTime.' },
        { status: 400 }
      );
    }

    const trip = await createTrip({
      routeId,
      busId,
      driverId,
      conductorId,
      travelDate,
      departureTime,
      arrivalTime,
      operationalNotes,
    });

    return NextResponse.json({
      success: true,
      trip,
      message: 'Trip scheduled and published successfully.',
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to schedule trip';
    return NextResponse.json({ error: err }, { status: 400 });
  }
}
