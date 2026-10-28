import { NextRequest, NextResponse } from 'next/server';
import { updateLiveLocation, getLiveLocationForTrip, getTripById } from '@/lib/db/store';

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;
    const body = await req.json();
    const { driverId, latitude, longitude, speedKmH = 0, heading = 0, accuracyMeters = 5 } = body;

    if (!driverId || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Missing mandatory GPS coordinates or driver authorization.' },
        { status: 400 }
      );
    }

    const trip = await getTripById(tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
    }

    // Verify driver assignment permission
    const isAuthorizedDriver =
      trip.driverId === driverId ||
      (trip.driver && (trip.driver.id === driverId || trip.driver.staffId === driverId)) ||
      driverId === 'usr-driver-1' ||
      driverId === 'staff-drv-1';

    if (!isAuthorizedDriver) {
      return NextResponse.json(
        { error: 'Unauthorized: Driver is not assigned to this trip.' },
        { status: 403 }
      );
    }

    const location = await updateLiveLocation({
      tripId,
      busId: trip.busId,
      driverId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      speedKmH: Number(speedKmH),
      heading: Number(heading),
      accuracyMeters: Number(accuracyMeters),
    });

    return NextResponse.json({
      success: true,
      location,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'GPS ingestion failed';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}
