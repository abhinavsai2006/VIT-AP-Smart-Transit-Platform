import { NextRequest, NextResponse } from 'next/server';
import { getFuelRecords, createFuelRecord } from '@/lib/db/store';

export async function GET() {
  try {
    const fuel = await getFuelRecords();
    return NextResponse.json({ fuel });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to retrieve fuel records';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { busId, fuelType, quantityLiters, costPerLiter, odometerReading, fuelStation, date, recordedBy } = body;

    if (!busId || !quantityLiters || !costPerLiter) {
      return NextResponse.json(
        { error: 'Bus ID, fuel quantity in liters, and cost per liter are required.' },
        { status: 400 }
      );
    }

    const q = Number(quantityLiters);
    const c = Number(costPerLiter);
    const totalCost = Math.round(q * c * 100) / 100;

    const record = await createFuelRecord({
      busId,
      fuelType: fuelType || 'diesel',
      quantityLiters: q,
      costPerLiter: c,
      totalCost,
      odometerReading: Number(odometerReading || 0),
      fuelStation: fuelStation || 'IOCL Institutional Pump',
      date: date || new Date().toISOString().split('T')[0],
      recordedBy: recordedBy || 'Driver / Refuel Attendant',
    });

    return NextResponse.json({ success: true, record });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to record fuel log';
    return NextResponse.json({ error: err }, { status: 400 });
  }
}
