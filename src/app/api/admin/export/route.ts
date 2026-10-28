import { NextResponse } from 'next/server';
import { getBuses, getTrips, getAllScans, getComplaints } from '@/lib/db/store';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'fleet';

    let csvContent = '';
    const filename = `vitap-transit-${type}-${new Date().toISOString().split('T')[0]}.csv`;

    if (type === 'fleet') {
      const buses = await getBuses();
      const headers = ['Bus ID', 'Fleet Code', 'Registration (Raw)', 'Normalized Reg', 'Model', 'Manufacturer', 'Capacity', 'Fuel Type', 'Status', 'Depot'];
      const rows = buses.map((b) => [
        `"${b.id}"`,
        `"${b.busCode}"`,
        `"${b.rawRegistration}"`,
        `"${b.registrationNumber}"`,
        `"${b.model}"`,
        `"${b.manufacturer}"`,
        b.seatingCapacity,
        `"${b.fuelType}"`,
        `"${b.status}"`,
        `"${b.assignedDepot}"`,
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (type === 'trips') {
      const trips = await getTrips();
      const headers = ['Trip ID', 'Route Number', 'Travel Date', 'Departure Time', 'Arrival Time', 'Bus Reg', 'Driver', 'Conductor', 'Total Seats', 'Booked Seats', 'Status'];
      const rows = trips.map((t) => [
        `"${t.id}"`,
        `"${t.route?.routeNumber || ''}"`,
        `"${t.travelDate}"`,
        `"${t.departureTime}"`,
        `"${t.arrivalTime}"`,
        `"${t.bus?.registrationNumber || ''}"`,
        `"${t.driver?.fullName || ''}"`,
        `"${t.conductor?.fullName || ''}"`,
        t.totalSeats,
        t.bookedSeats,
        `"${t.status}"`,
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (type === 'scans') {
      const scans = await getAllScans();
      const headers = ['Scan ID', 'Ticket ID', 'Trip ID', 'Ticket Number', 'Passenger Name', 'Scan Result', 'Validator Staff ID', 'Timestamp', 'Notes'];
      const rows = scans.map((s) => [
        `"${s.id}"`,
        `"${s.ticketId}"`,
        `"${s.tripId}"`,
        `"${s.ticketNumber || ''}"`,
        `"${s.passengerName || ''}"`,
        `"${s.scanResult}"`,
        `"${s.scannedByStaffId}"`,
        `"${s.scannedAt}"`,
        `"${(s.notes || '').replace(/"/g, '""')}"`,
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else if (type === 'complaints') {
      const complaints = await getComplaints();
      const headers = ['Case Number', 'Passenger Name', 'Category', 'Priority', 'Status', 'Submitted At', 'Description'];
      const rows = complaints.map((c) => [
        `"${c.caseNumber}"`,
        `"${c.passengerName}"`,
        `"${c.category}"`,
        `"${c.priority}"`,
        `"${c.status}"`,
        `"${c.submittedAt}"`,
        `"${(c.description || '').replace(/"/g, '""')}"`,
      ]);
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    } else {
      return NextResponse.json({ success: false, error: 'Invalid export type. Must be fleet, trips, scans, or complaints.' }, { status: 400 });
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
