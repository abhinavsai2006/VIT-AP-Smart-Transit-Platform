import { NextRequest, NextResponse } from 'next/server';
import {
  getComplaints,
  getComplaintsForUser,
  createComplaint,
  addComplaintMessage,
  updateComplaintStatus,
} from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    const complaints = userId
      ? await getComplaintsForUser(userId)
      : await getComplaints();

    return NextResponse.json({ complaints });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to retrieve complaints';
    return NextResponse.json({ error: err }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'add_message') {
      const { complaintId, senderId, senderName, senderRole, message, isInternal } = body;
      const msg = await addComplaintMessage({
        complaintId,
        senderId,
        senderName,
        senderRole,
        message,
        isInternal,
      });
      return NextResponse.json({ success: true, message: msg });
    }

    if (action === 'update_status') {
      const { id, status, resolutionNotes } = body;
      const comp = await updateComplaintStatus(id, status, resolutionNotes);
      return NextResponse.json({ success: true, complaint: comp });
    }

    const { userId, passengerName, category, tripId, busId, description, priority } = body;

    if (!userId || !passengerName || !category || !description) {
      return NextResponse.json(
        { error: 'Passenger name, category, and issue description are required.' },
        { status: 400 }
      );
    }

    const complaint = await createComplaint({
      userId,
      passengerName,
      category,
      tripId,
      busId,
      description,
      priority,
    });

    return NextResponse.json({ success: true, complaint });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Complaint operation failed';
    return NextResponse.json({ error: err }, { status: 400 });
  }
}
