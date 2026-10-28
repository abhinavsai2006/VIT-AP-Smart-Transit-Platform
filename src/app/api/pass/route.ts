import { NextRequest, NextResponse } from 'next/server';
import { getBusPassForUser, getBusPassById, getAllBusPasses, createBusPass, updateUserPreferences } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (id) {
      const pass = await getBusPassById(id);
      if (!pass) {
        return NextResponse.json({ success: false, error: 'Bus pass not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, pass });
    }

    if (userId) {
      const pass = await getBusPassForUser(userId);
      return NextResponse.json({ success: true, pass: pass || null });
    }

    const passes = await getAllBusPasses();
    return NextResponse.json({ success: true, passes });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to retrieve bus pass';
    return NextResponse.json({ success: false, error: err }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.userId || !body.studentName || !body.regNumber || !body.routeNumber || !body.pickupStopName) {
      return NextResponse.json(
        { success: false, error: 'Missing mandatory bus pass fields (userId, studentName, regNumber, routeNumber, pickupStopName).' },
        { status: 400 }
      );
    }

    const newPass = await createBusPass({
      userId: body.userId,
      studentName: body.studentName,
      regNumber: body.regNumber,
      program: body.program || 'B.Tech Engineering',
      department: body.department || 'School of Technology',
      academicYear: body.academicYear || '2026-2027',
      semester: body.semester || 'Fall 2026',
      routeId: body.routeId || `route-${body.routeNumber.toLowerCase()}`,
      routeNumber: body.routeNumber,
      routeName: body.routeName || `${body.routeNumber} Commuter Express`,
      pickupStopId: body.pickupStopId || 'stop-pickup-default',
      pickupStopName: body.pickupStopName,
      pickupTime: body.pickupTime || '07:30 AM',
      dropStopName: 'VIT-AP Central Campus',
      dropTime: '08:45 AM',
      validFrom: body.validFrom || '2026-07-01',
      validUntil: body.validUntil || '2027-06-30',
      status: 'active',
      photoUrl: body.photoUrl,
      issuedBy: body.issuedBy || 'Mr. K. Narayana (Chief Transport Officer)',
      emergencyContact: '+91 863 2370 444',
    });

    return NextResponse.json({ success: true, pass: newPass }, { status: 201 });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to issue bus pass';
    return NextResponse.json({ success: false, error: err }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, preferredRouteId, preferredStopId } = body;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const updatedUser = await updateUserPreferences(userId, { preferredRouteId, preferredStopId });
    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Failed to update preferences';
    return NextResponse.json({ success: false, error: err }, { status: 500 });
  }
}
