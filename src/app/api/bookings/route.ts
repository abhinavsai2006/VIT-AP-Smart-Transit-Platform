import { NextRequest, NextResponse } from 'next/server';
import { createBooking, getBookingsForUser } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'usr-student-1';
    const bookings = await getBookingsForUser(userId);
    return NextResponse.json({ bookings });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to retrieve bookings';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      tripId,
      passengerName,
      passengerEmail,
      passengerPhone,
      passengerType = 'student',
      originStopId,
      destinationStopId,
      seatCount = 1,
    } = body;

    if (!userId || !tripId || !passengerName || !originStopId || !destinationStopId) {
      return NextResponse.json(
        { error: 'Missing mandatory booking parameters (userId, tripId, passengerName, originStopId, destinationStopId).' },
        { status: 400 }
      );
    }

    const booking = await createBooking({
      userId,
      tripId,
      passengerName,
      passengerEmail: passengerEmail || `${userId}@vitap.ac.in`,
      passengerPhone: passengerPhone || '+91 98765 00000',
      passengerType,
      originStopId,
      destinationStopId,
      seatCount: Number(seatCount),
    });

    return NextResponse.json({
      success: true,
      booking,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Reservation failed';
    return NextResponse.json({ error: err }, { status: 400 });
  }
}
