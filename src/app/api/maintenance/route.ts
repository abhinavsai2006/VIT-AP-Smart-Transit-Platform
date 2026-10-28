import { NextRequest, NextResponse } from 'next/server';
import { getMaintenanceRecords, createMaintenanceRecord } from '@/lib/db/store';

export async function GET() {
  try {
    const records = await getMaintenanceRecords();
    return NextResponse.json({ records });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to retrieve maintenance records';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      busId,
      maintenanceType,
      description,
      partsCost,
      labourCost,
      totalCost,
      vendorName,
      odometerAtService,
      serviceDate,
      status,
      reportedBy,
    } = body;

    if (!busId || !maintenanceType || !description || !serviceDate) {
      return NextResponse.json(
        { error: 'Bus ID, maintenance type, description, and service date are required.' },
        { status: 400 }
      );
    }

    const calculatedTotal =
      totalCost !== undefined ? Number(totalCost) : Number(partsCost || 0) + Number(labourCost || 0);

    const record = await createMaintenanceRecord({
      busId,
      maintenanceType,
      description,
      partsCost: Number(partsCost || 0),
      labourCost: Number(labourCost || 0),
      totalCost: calculatedTotal,
      vendorName: vendorName || 'Amaravati Fleet Workshop',
      odometerAtService: Number(odometerAtService || 0),
      serviceDate,
      status: status || 'scheduled',
      reportedBy: reportedBy || 'Fleet Supervisor',
    });

    return NextResponse.json({ success: true, record });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to log maintenance record';
    return NextResponse.json({ error: err }, { status: 400 });
  }
}
