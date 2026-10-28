import { NextRequest, NextResponse } from 'next/server';
import { getBuses, createBus } from '@/lib/db/store';

export async function GET() {
  try {
    const buses = await getBuses();
    return NextResponse.json({ buses });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to retrieve fleet';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      busCode,
      rawRegistration,
      vehicleType,
      model,
      manufacturer,
      seatingCapacity,
      standingCapacity,
      hasWheelchairAccess,
      fuelType,
      assignedDepot,
      adminOverride,
    } = body;

    if (!busCode || !rawRegistration || !vehicleType || !seatingCapacity) {
      return NextResponse.json(
        { error: 'Missing mandatory fields: busCode, rawRegistration, vehicleType, seatingCapacity.' },
        { status: 400 }
      );
    }

    const bus = await createBus({
      busCode,
      rawRegistration,
      vehicleType,
      model: model || 'Standard Heavy Vehicle',
      manufacturer: manufacturer || 'Commercial Vehicle OEM',
      seatingCapacity: Number(seatingCapacity),
      standingCapacity: Number(standingCapacity || 0),
      hasWheelchairAccess: Boolean(hasWheelchairAccess),
      fuelType: fuelType || 'diesel',
      assignedDepot: assignedDepot || 'Amaravati Central Depot',
      adminOverride: Boolean(adminOverride),
    });

    return NextResponse.json({
      success: true,
      bus,
      message: `Vehicle ${bus.registrationNumber} registered successfully in university fleet.`,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to add vehicle to fleet';
    return NextResponse.json({ error: err }, { status: 400 });
  }
}
