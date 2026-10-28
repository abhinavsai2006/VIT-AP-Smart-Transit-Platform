import { NextRequest, NextResponse } from 'next/server';
import { getEventRequests, createEventRequest, updateEventRequestStatus } from '@/lib/db/store';

export async function GET() {
  try {
    const eventRequests = await getEventRequests();
    return NextResponse.json({ eventRequests });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to retrieve event requests';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      id,
      status,
      approvedBusIds,
      department,
      eventName,
      coordinatorName,
      coordinatorEmail,
      coordinatorPhone,
      pickupLocation,
      dropLocation,
      startDate,
      endDate,
      passengerCount,
      requestedBuses,
      purpose,
      notes,
    } = body;

    if (action === 'update_status' && id && status) {
      const updated = await updateEventRequestStatus(id, status, approvedBusIds || [], notes);
      return NextResponse.json({ success: true, eventRequest: updated });
    }

    if (!department || !eventName || !coordinatorName || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Department, event name, coordinator, and dates are mandatory.' },
        { status: 400 }
      );
    }

    const created = await createEventRequest({
      department,
      eventName,
      coordinatorName,
      coordinatorEmail: coordinatorEmail || 'coordinator@vitap.ac.in',
      coordinatorPhone: coordinatorPhone || '+91 98480 00000',
      pickupLocation: pickupLocation || 'Vijayawada Railway Station',
      dropLocation: dropLocation || 'VIT-AP Central Campus',
      startDate,
      endDate,
      passengerCount: Number(passengerCount || 50),
      requestedBuses: Number(requestedBuses || 1),
      purpose: purpose || 'Official University Event Transportation',
      notes,
    });

    return NextResponse.json({ success: true, eventRequest: created });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Event request processing failed';
    return NextResponse.json({ error: err }, { status: 400 });
  }
}
