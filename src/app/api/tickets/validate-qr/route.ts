import { NextRequest, NextResponse } from 'next/server';
import { validateAndConsumeTicket } from '@/lib/db/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, tripId, scannedByStaffId, deviceFingerprint } = body;

    if (!token || !tripId || !scannedByStaffId) {
      return NextResponse.json(
        { error: 'Mandatory validation fields missing: token, tripId, scannedByStaffId.' },
        { status: 400 }
      );
    }

    const scan = await validateAndConsumeTicket({
      token,
      tripId,
      scannedByStaffId,
      deviceFingerprint: deviceFingerprint || req.headers.get('user-agent') || 'UNKNOWN_DEVICE',
    });

    return NextResponse.json({
      success: scan.scanResult === 'valid',
      scan,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'QR validation failed';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}
