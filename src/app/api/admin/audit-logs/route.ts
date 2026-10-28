import { NextResponse } from 'next/server';
import { getAuditLogs, addAuditLog } from '@/lib/db/store';

export async function GET() {
  try {
    const logs = await getAuditLogs();
    return NextResponse.json({ success: true, logs });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.action || !body.entityType || !body.entityId || !body.performedBy) {
      return NextResponse.json(
        { success: false, error: 'action, entityType, entityId, and performedBy are required.' },
        { status: 400 }
      );
    }
    const log = await addAuditLog({
      action: body.action,
      entityType: body.entityType,
      entityId: body.entityId,
      performedBy: body.performedBy,
      details: body.details || {},
      ipAddress: body.ipAddress,
    });
    return NextResponse.json({ success: true, log }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
