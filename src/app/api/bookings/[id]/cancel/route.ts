import { NextRequest, NextResponse } from 'next/server';
import { cancelBooking } from '@/lib/db/store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required for authorization.' }, { status: 401 });
    }

    const cancelledBooking = await cancelBooking(id, userId);

    return NextResponse.json({
      success: true,
      booking: cancelledBooking,
      message: 'Booking cancelled successfully and seat restored.',
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to cancel booking';
    return NextResponse.json({ error: err }, { status: 400 });
  }
}
