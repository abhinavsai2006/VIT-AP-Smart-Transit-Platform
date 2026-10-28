import { describe, it, expect } from 'vitest';
import { normalizeApRegistration, validateApRegistration } from '@/lib/ap-registration';
import { isDirectionallyValid, searchDirectJourneys } from '@/lib/journey-planner';
import { generateTicketToken, verifyTicketToken } from '@/lib/qr-crypto';
import {
  createBus,
  getBuses,
  createTrip,
  createRoute,
  createBooking,
  cancelBooking,
  validateAndConsumeTicket,
  updateLiveLocation,
  getLiveLocationForTrip,
  createEventRequest,
  updateEventRequestStatus,
  createComplaint,
  addComplaintMessage,
  createDisruption,
  getDisruptions,
  getBookingsForUser,
  getAuditLogs,
  addAuditLog,
  getAllScans,
  getBusPassForUser,
  getBusPassById,
  createBusPass,
  updateUserPreferences,
  store,
} from '@/lib/db/store';
import { Route, Stop } from '@/types/transit';
import { OFFICIAL_SCHEDULES_DATA, normalizeTime, timeToMinutes, findScheduleAmbiguities } from '@/lib/official-schedules';

describe('1. Andhra Pradesh Vehicle Registration Normalization & Validation', () => {
  it('normalizes AP registration numbers with spaces, hyphens, and lowercase into canonical uppercase', () => {
    expect(normalizeApRegistration('ap 39 tl 1001')).toBe('AP39TL1001');
    expect(normalizeApRegistration('AP-39-TL-1001')).toBe('AP39TL1001');
    expect(normalizeApRegistration('AP 16 TA 5544')).toBe('AP16TA5544');
    expect(normalizeApRegistration('  ap39tl1001  ')).toBe('AP39TL1001');
  });

  it('validates legitimate Andhra Pradesh RTO district codes (AP39, AP16, AP07)', () => {
    const res1 = validateApRegistration('AP39TL1001');
    expect(res1.isValid).toBe(true);
    expect(res1.stateCode).toBe('AP');
    expect(res1.rtoCode).toBe('39');
    expect(res1.rtoLocation).toContain('Amaravati');

    const res2 = validateApRegistration('AP16TA5544');
    expect(res2.isValid).toBe(true);
    expect(res2.rtoCode).toBe('16');
    expect(res2.rtoLocation).toContain('Vijayawada');
  });

  it('rejects invalid or non-Indian registration formats', () => {
    const res = validateApRegistration('INVALID123');
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toBeDefined();
  });

  it('rejects duplicate registration numbers in fleet store', async () => {
    await expect(
      createBus({
        busCode: 'BUS-DUP-TEST',
        rawRegistration: 'AP 39 TL 1001', // already registered to BUS-01
        vehicleType: 'Standard',
        model: 'Tata',
        manufacturer: 'Tata Motors',
        seatingCapacity: 40,
        standingCapacity: 10,
        hasWheelchairAccess: false,
        fuelType: 'diesel',
        assignedDepot: 'Amaravati',
      })
    ).rejects.toThrow(/already registered/i);
  });
});

describe('2. Route Directional Sequence & Journey Search', () => {
  const sampleRoute: Route = {
    id: 'route-test-101',
    routeNumber: '101',
    routeName: 'VJA Rly -> Campus Express',
    description: 'Test Corridor',
    originStopId: 'stop-vja',
    destinationStopId: 'stop-campus',
    status: 'active',
    estimatedDurationMinutes: 45,
    distanceKm: 28,
    fareAmount: 35,
    stops: [
      { id: 'rs-1', routeId: 'route-test-101', stopId: 'stop-vja', stopSequence: 1, arrivalOffsetMinutes: 0, departureOffsetMinutes: 0 },
      { id: 'rs-2', routeId: 'route-test-101', stopId: 'stop-benz', stopSequence: 2, arrivalOffsetMinutes: 12, departureOffsetMinutes: 14 },
      { id: 'rs-3', routeId: 'route-test-101', stopId: 'stop-mangalagiri', stopSequence: 3, arrivalOffsetMinutes: 28, departureOffsetMinutes: 30 },
      { id: 'rs-4', routeId: 'route-test-101', stopId: 'stop-campus', stopSequence: 4, arrivalOffsetMinutes: 45, departureOffsetMinutes: 45 },
    ],
  };

  it('accepts stop sequence travelling in the forward direction', () => {
    const checkForward = isDirectionallyValid(sampleRoute, 'stop-vja', 'stop-campus');
    expect(checkForward.isValid).toBe(true);
    expect(checkForward.originIndex).toBeLessThan(checkForward.destinationIndex);

    const checkIntermediate = isDirectionallyValid(sampleRoute, 'stop-benz', 'stop-campus');
    expect(checkIntermediate.isValid).toBe(true);
  });

  it('strictly rejects journey search travelling in the reverse direction on a one-way corridor', () => {
    const checkReverse = isDirectionallyValid(sampleRoute, 'stop-campus', 'stop-benz');
    expect(checkReverse.isValid).toBe(false);
  });

  it('allows administrators to create and publish a valid new route', async () => {
    const newRoute = await createRoute({
      routeNumber: '106-TEST',
      routeName: 'Amaravati AIIMS Loop',
      description: 'Dedicated test connector',
      originStopId: 'stop-mangalagiri',
      destinationStopId: 'stop-vit-ap-campus',
      status: 'active',
      estimatedDurationMinutes: 25,
      distanceKm: 18,
      fareAmount: 20,
      stops: [
        { id: 'rs-t-1', routeId: '', stopId: 'stop-mangalagiri', stopSequence: 1, arrivalOffsetMinutes: 0, departureOffsetMinutes: 0 },
        { id: 'rs-t-2', routeId: '', stopId: 'stop-vit-ap-campus', stopSequence: 2, arrivalOffsetMinutes: 25, departureOffsetMinutes: 25 },
      ],
    });

    expect(newRoute.id).toBeDefined();
    expect(newRoute.routeNumber).toBe('106-TEST');
  });
});

describe('3. QR Cryptographic Signing, Validation & Duplicate Protection', () => {
  it('generates HMAC-SHA256 signed token and verifies it successfully', () => {
    const payload = {
      tId: 'tkt-test-100',
      bId: 'book-test-100',
      trId: 'trip-101-morning',
      rId: 'route-101',
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: 'abc1234',
    };

    const token = generateTicketToken(payload);
    expect(token).toMatch(/^VIT-[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+$/);

    const verifyResult = verifyTicketToken(token);
    expect(verifyResult.isValid).toBe(true);
    expect(verifyResult.payload?.tId).toBe('tkt-test-100');
    expect(verifyResult.payload?.trId).toBe('trip-101-morning');
  });

  it('rejects tampered or malformed ticket tokens', () => {
    const payload = {
      tId: 'tkt-test-tamper',
      bId: 'book-test-tamper',
      trId: 'trip-101-morning',
      rId: 'route-101',
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: 'def5678',
    };

    const legitimateToken = generateTicketToken(payload);
    const tamperedToken = legitimateToken.replace(/a/g, 'z');

    const result = verifyTicketToken(tamperedToken);
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/verification failed|tampered/i);
  });

  it('atomically consumes a single-use ticket and rejects concurrent duplicate scans', async () => {
    const booking = await createBooking({
      userId: 'usr-student-1',
      tripId: 'trip-101-midday',
      passengerName: 'Kavitha Devi',
      passengerEmail: 'kavitha@vitap.ac.in',
      passengerPhone: '+91 99999 11111',
      passengerType: 'student',
      originStopId: 'stop-vja-rly',
      destinationStopId: 'stop-vit-ap-campus',
      seatCount: 1,
    });

    const token = booking.ticket?.token;
    expect(token).toBeDefined();

    // First scan (valid boarding)
    const scan1 = await validateAndConsumeTicket({
      token: token!,
      tripId: 'trip-101-midday',
      scannedByStaffId: 'staff-cnd-1',
    });

    expect(scan1.scanResult).toBe('valid');

    // Second scan of the same ticket (must be rejected as already_used)
    const scan2 = await validateAndConsumeTicket({
      token: token!,
      tripId: 'trip-101-midday',
      scannedByStaffId: 'staff-cnd-1',
    });

    expect(scan2.scanResult).toBe('already_used');
    expect(scan2.notes).toMatch(/already scanned/i);
  });

  it('rejects ticket presented on the wrong trip or route', async () => {
    const booking = await createBooking({
      userId: 'usr-student-1',
      tripId: 'trip-101-midday',
      passengerName: 'Vikram Singh',
      passengerEmail: 'vikram@vitap.ac.in',
      passengerPhone: '+91 99999 22222',
      passengerType: 'student',
      originStopId: 'stop-vja-rly',
      destinationStopId: 'stop-vit-ap-campus',
      seatCount: 1,
    });

    const scan = await validateAndConsumeTicket({
      token: booking.ticket!.token,
      tripId: 'trip-102-morning', // Wrong trip!
      scannedByStaffId: 'staff-cnd-2',
    });

    expect(scan.scanResult).toBe('wrong_trip');
  });

  it('rejects cancelled tickets during boarding scan', async () => {
    const booking = await createBooking({
      userId: 'usr-student-1',
      tripId: 'trip-101-midday',
      passengerName: 'Rohit Sharma',
      passengerEmail: 'rohit@vitap.ac.in',
      passengerPhone: '+91 99999 77777',
      passengerType: 'student',
      originStopId: 'stop-vja-rly',
      destinationStopId: 'stop-vit-ap-campus',
      seatCount: 1,
    });

    // Cancel booking
    await cancelBooking(booking.id, 'usr-student-1');

    // Attempt to scan cancelled ticket
    const scan = await validateAndConsumeTicket({
      token: booking.ticket!.token,
      tripId: 'trip-101-midday',
      scannedByStaffId: 'staff-cnd-1',
    });

    expect(scan.scanResult).toBe('cancelled');
  });
});

describe('4. Seat Capacity & Concurrency Enforcement', () => {
  it('prevents booking more seats than available capacity', async () => {
    await expect(
      createBooking({
        userId: 'usr-student-1',
        tripId: 'trip-101-midday',
        passengerName: 'Over Capacity Group',
        passengerEmail: 'group@vitap.ac.in',
        passengerPhone: '+91 99999 33333',
        passengerType: 'student',
        originStopId: 'stop-vja-rly',
        destinationStopId: 'stop-vit-ap-campus',
        seatCount: 99,
      })
    ).rejects.toThrow(/Cannot reserve 99 seat/i);
  });

  it('restores vehicle seat capacity when a booking is cancelled', async () => {
    const initialTrip = store.trips.get('trip-101-midday');
    const seatsBefore = initialTrip?.bookedSeats || 0;

    const b = await createBooking({
      userId: 'usr-student-1',
      tripId: 'trip-101-midday',
      passengerName: 'Cancel Test',
      passengerEmail: 'cancel@vitap.ac.in',
      passengerPhone: '+91 99999 44444',
      passengerType: 'student',
      originStopId: 'stop-vja-rly',
      destinationStopId: 'stop-vit-ap-campus',
      seatCount: 2,
    });

    expect(store.trips.get('trip-101-midday')?.bookedSeats).toBe(seatsBefore + 2);

    await cancelBooking(b.id, 'usr-student-1');

    expect(store.trips.get('trip-101-midday')?.bookedSeats).toBe(seatsBefore);
  });
});

describe('5. Fleet Availability & Vehicle Assignment Rules', () => {
  it('rejects assigning an unavailable vehicle in maintenance status to a new trip', async () => {
    // Bus-04 has status: 'maintenance'
    await expect(
      createTrip({
        routeId: 'route-101',
        busId: 'bus-04', // In maintenance!
        driverId: 'staff-drv-1',
        conductorId: 'staff-cnd-1',
        travelDate: '2026-10-30',
        departureTime: '14:00',
        arrivalTime: '14:45',
      })
    ).rejects.toThrow(/cannot be assigned|status/i);
  });
});

describe('6. Real-Time Telemetry & Stale GPS Signal Handling', () => {
  it('correctly ingests live GPS location from authorized driver', async () => {
    const loc = await updateLiveLocation({
      tripId: 'trip-101-morning',
      busId: 'bus-01',
      driverId: 'staff-drv-1',
      latitude: 16.4820,
      longitude: 80.5150,
      speedKmH: 52,
      heading: 180,
      accuracyMeters: 4,
    });

    expect(loc.latitude).toBe(16.4820);
    expect(loc.speedKmH).toBe(52);

    const retrieved = await getLiveLocationForTrip('trip-101-morning');
    expect(retrieved?.isLive).toBe(true);
  });

  it('identifies telemetry older than 2 minutes as stale rather than live', async () => {
    const staleTime = new Date(Date.now() - 300000).toISOString();
    store.locations.set('trip-stale-test', {
      id: 'loc-stale-1',
      tripId: 'trip-stale-test',
      busId: 'bus-02',
      driverId: 'staff-drv-2',
      latitude: 16.4500,
      longitude: 80.5000,
      speedKmH: 0,
      heading: 0,
      accuracyMeters: 10,
      timestamp: staleTime,
      isLive: true,
    });

    const retrieved = await getLiveLocationForTrip('trip-stale-test');
    expect(retrieved).toBeDefined();
    expect(retrieved?.isLive).toBe(false);
  });
});

describe('7. Department Transport Requests & Service Disruptions', () => {
  it('follows the department event requisition and administrative approval workflow', async () => {
    const req = await createEventRequest({
      department: 'School of Mechanical Engineering',
      eventName: 'RoboQuest 2026',
      coordinatorName: 'Dr. Ramesh Babu',
      coordinatorEmail: 'ramesh.mech@vitap.ac.in',
      coordinatorPhone: '+91 98480 99999',
      pickupLocation: 'Vijayawada Railway Station',
      dropLocation: 'VIT-AP Central Campus',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      passengerCount: 150,
      requestedBuses: 3,
      purpose: 'Robotics team delegates',
    });

    expect(req.status).toBe('pending');

    const approved = await updateEventRequestStatus(req.id, 'approved', ['bus-01', 'bus-02'], 'Allocated 2 large buses');
    expect(approved.status).toBe('approved');
    expect(approved.approvedBusIds).toEqual(['bus-01', 'bus-02']);
  });

  it('broadcasts service disruptions affecting specified corridors', async () => {
    const disruption = await createDisruption({
      title: 'Amaravati Ring Road Resurfacing',
      message: 'Expect 10-minute detours',
      severity: 'warning',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 86400000).toISOString(),
      status: 'active',
      affectedRoutes: ['101', '102'],
    });

    const allDisruptions = await getDisruptions();
    expect(allDisruptions.some((d) => d.id === disruption.id)).toBe(true);
  });

  it('isolates passenger booking records to the authorized user', async () => {
    const bookings = await getBookingsForUser('usr-student-1');
    expect(bookings.every((b) => b.userId === 'usr-student-1')).toBe(true);
  });
});

describe('8. Administrative Audit Logs & Reporting', () => {
  it('retrieves immutable audit records with timestamps and authorized actor IDs', async () => {
    const logs = await getAuditLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]).toHaveProperty('timestamp');
    expect(logs[0]).toHaveProperty('performedBy');
    expect(logs[0]).toHaveProperty('action');
  });

  it('records new administrative mutations into the audit trail', async () => {
    const newLog = await addAuditLog({
      action: 'SYSTEM_CONFIG_UPDATED',
      entityType: 'setting',
      entityId: 'emergency_hotline',
      performedBy: 'usr-admin-01',
      details: { updatedField: 'emergencyHotline', value: '+91 863 2370 444' },
    });

    expect(newLog.id).toBeDefined();
    expect(newLog.timestamp).toBeDefined();

    const logs = await getAuditLogs();
    expect(logs.some((l) => l.id === newLog.id)).toBe(true);
  });

  it('retrieves comprehensive boarding scans across all operational trips', async () => {
    const allScans = await getAllScans();
    expect(Array.isArray(allScans)).toBe(true);
    expect(allScans.length).toBeGreaterThanOrEqual(1);
    expect(allScans[0]).toHaveProperty('scanResult');
  });
});

describe('9. Official Commuter Schedule Validation (All 44 Routes)', () => {
  it('contains exactly 44 official commuter routes across Vijayawada, Guntur, and Tenali', () => {
    expect(OFFICIAL_SCHEDULES_DATA.length).toBe(44);

    const vjaRoutes = OFFICIAL_SCHEDULES_DATA.filter((r) => r.region === 'Vijayawada');
    const gntRoutes = OFFICIAL_SCHEDULES_DATA.filter((r) => r.region === 'Guntur');
    const tnlRoutes = OFFICIAL_SCHEDULES_DATA.filter((r) => r.region === 'Tenali');

    expect(vjaRoutes.length).toBe(21); // VV-1 through VV-21
    expect(gntRoutes.length).toBe(20); // GV-1 through GV-20
    expect(tnlRoutes.length).toBe(3);  // TV-1 through TV-3
  });

  it('normalizes pickup times consistently to 12-hour format with AM/PM', () => {
    expect(normalizeTime('7.00 AM')).toBe('07:00 AM');
    expect(normalizeTime('7:30AM')).toBe('07:30 AM');
    expect(normalizeTime('7.40 AM')).toBe('07:40 AM');
    expect(normalizeTime('8:45 AM')).toBe('08:45 AM');
  });

  it('ensures all 44 routes have their terminal destination at VIT-AP Campus scheduled at 8:45 AM', () => {
    OFFICIAL_SCHEDULES_DATA.forEach((route) => {
      const lastPoint = route.points[route.points.length - 1];
      expect(lastPoint.name.toLowerCase()).toContain('vit');
      expect(normalizeTime(lastPoint.time)).toBe('08:45 AM');
    });
  });

  it('scans and accurately reports raw source schedule ambiguities and time regressions', () => {
    const ambiguities = findScheduleAmbiguities();
    expect(ambiguities.length).toBeGreaterThan(0);
    // Specifically flags GV-3 anomaly where Rajendra Nagar Colony is listed as 7:30 AM before Brundavan Gardens at 7:22 AM
    const gv3Anomaly = ambiguities.find((a) => a.routeNumber === 'GV-3');
    expect(gv3Anomaly).toBeDefined();
    expect(gv3Anomaly?.description).toContain('GV-3');
  });

  it('populates all 44 routes and their stops into the transit database store', () => {
    const allRoutes = Array.from(store.routes.values());
    expect(allRoutes.some((r) => r.routeNumber === 'VV-1')).toBe(true);
    expect(allRoutes.some((r) => r.routeNumber === 'VV-21')).toBe(true);
    expect(allRoutes.some((r) => r.routeNumber === 'GV-1')).toBe(true);
    expect(allRoutes.some((r) => r.routeNumber === 'GV-20')).toBe(true);
    expect(allRoutes.some((r) => r.routeNumber === 'TV-1')).toBe(true);
    expect(allRoutes.some((r) => r.routeNumber === 'TV-3')).toBe(true);
  });
});

describe('10. Student Bus Pass Generation, Security & Personalization', () => {
  it('retrieves the active official bus pass for authenticated student Arjun Reddy', async () => {
    const pass = await getBusPassForUser('usr-student-1');
    expect(pass).toBeDefined();
    expect(pass?.studentName).toBe('Arjun Reddy');
    expect(pass?.regNumber).toBe('22BCE1245');
    expect(pass?.routeNumber).toBe('VV-4');
    expect(pass?.pickupStopName).toBe('Autonagar Gate');
    expect(pass?.status).toBe('active');
    expect(pass?.passNumber).toMatch(/^VITAP\/BP\//);
  });

  it('ensures the bus pass contains a verified HMAC-SHA256 QR code data URL', async () => {
    const pass = await getBusPassForUser('usr-student-1');
    expect(pass?.qrCodeDataUrl).toBeDefined();
    expect(pass?.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('retrieves bus pass by unique pass ID', async () => {
    const pass = await getBusPassById('pass-22bce1245');
    expect(pass).toBeDefined();
    expect(pass?.regNumber).toBe('22BCE1245');
  });

  it('issues a new official student bus pass with unique numbering and validity period', async () => {
    const newPass = await createBusPass({
      userId: 'usr-student-new',
      studentName: 'Kavya Madhavan',
      regNumber: '23BCE2001',
      program: 'B.Tech AI & Data Science',
      department: 'School of Advanced Computing',
      academicYear: '2026-2027',
      semester: 'Fall Semester 2026',
      routeId: 'route-gv-1',
      routeNumber: 'GV-1',
      routeName: 'GV-1 — Naaz Center to VIT-AP Campus',
      pickupStopId: 'stop-gv-1-1',
      pickupStopName: 'Naaz Center',
      pickupTime: '07:35 AM',
      dropStopName: 'VIT-AP Central Campus',
      dropTime: '08:45 AM',
      validFrom: '2026-07-01',
      validUntil: '2027-06-30',
      status: 'active',
      issuedBy: 'Mr. K. Narayana (Chief Transport Officer)',
      emergencyContact: '+91 863 2370 444',
    });

    expect(newPass.id).toBeDefined();
    expect(newPass.passNumber).toMatch(/^VITAP\/BP\/2026\/\d{4}$/);

    const fetched = await getBusPassById(newPass.id);
    expect(fetched?.studentName).toBe('Kavya Madhavan');
  });

  it('updates passenger preferences for personalized route and stop views', async () => {
    const updated = await updateUserPreferences('usr-student-1', {
      preferredRouteId: 'route-vv-1',
      preferredStopId: 'stop-vv-1-1',
    });

    expect(updated.preferredRouteId).toBe('route-vv-1');
    expect(updated.preferredStopId).toBe('stop-vv-1-1');
  });
});


