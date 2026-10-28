import { NextRequest, NextResponse } from 'next/server';
import { updateLiveLocation, getLiveLocationForTrip, getTripById, LocationRejectedError } from '@/lib/db/store';
import { busIdForDeviceToken, allowReport } from '@/lib/gps-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const location = await getLiveLocationForTrip(id);
    return NextResponse.json({ location: location || null });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to retrieve trip location';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}

/**
 * GPS ingestion for a bus's tracking device or driver app.
 * Auth: "Authorization: Bearer <device key>" (GPS_DEVICE_KEYS). The key identifies the bus;
 * the report is accepted only if that bus is assigned to this trip and the trip is running.
 * Body: { latitude, longitude, accuracyMeters, speedKmH?, heading?, recordedAt? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;

    const busId = busIdForDeviceToken(req.headers.get('authorization'));
    if (!busId) {
      return NextResponse.json({ error: 'Unauthorized: valid device key required.' }, { status: 401 });
    }

    const trip = await getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
    }
    if (!trip.busId || trip.busId !== busId) {
      return NextResponse.json({ error: 'Forbidden: this bus is not assigned to the trip.' }, { status: 403 });
    }
    if (trip.status === 'completed' || trip.status === 'cancelled') {
      return NextResponse.json({ error: `Trip is ${trip.status}; positions are no longer accepted.` }, { status: 409 });
    }
    if (!allowReport(busId)) {
      return NextResponse.json({ error: 'Too many reports; send at most one per second.' }, { status: 429 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
    }

    const num = (v: unknown) => (typeof v === 'number' ? v : v === undefined || v === null ? undefined : NaN);
    const latitude = num(body.latitude);
    const longitude = num(body.longitude);
    const accuracyMeters = num(body.accuracyMeters);
    if (latitude === undefined || longitude === undefined || accuracyMeters === undefined) {
      return NextResponse.json({ error: 'latitude, longitude and accuracyMeters are required numbers.' }, { status: 400 });
    }

    const location = await updateLiveLocation({
      tripId,
      busId,
      driverId: trip.driverId,
      latitude,
      longitude,
      accuracyMeters,
      speedKmH: num(body.speedKmH),
      heading: num(body.heading),
      recordedAt: typeof body.recordedAt === 'string' ? body.recordedAt : undefined,
    });

    return NextResponse.json({ success: true, location });
  } catch (error: unknown) {
    if (error instanceof LocationRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    // Don't leak internals for unexpected failures
    console.error('GPS ingestion failed', error);
    return NextResponse.json({ error: 'GPS ingestion failed' }, { status: 500 });
  }
}
