import {
  Stop,
  Route,
  Bus,
  StaffProfile,
  Trip,
  Booking,
  Ticket,
  BoardingScan,
  GPSLocation,
  ServiceDisruption,
  MaintenanceRecord,
  FuelRecord,
  Incident,
  EventRequest,
  Complaint,
  ComplaintMessage,
  Notification,
  AuditLog,
  UserProfile,
  BusPass,
} from '@/types/transit';

import {
  SEED_STOPS,
  SEED_ROUTES,
  SEED_BUSES,
  SEED_STAFF,
  SEED_TRIPS,
  SEED_BOOKINGS,
  SEED_DISRUPTIONS,
  SEED_MAINTENANCE,
  SEED_FUEL,
  SEED_INCIDENTS,
  SEED_EVENT_REQUESTS,
  SEED_COMPLAINTS,
  SEED_NOTIFICATIONS,
  SEED_USERS,
  SEED_BUS_PASSES,
} from '@/lib/seed-data';

import { buildOfficialTransitData, TIMETABLE_DATA_VERSION } from '@/lib/official-schedules';
import { generateTicketToken, generateQrCodeDataUrl, verifyTicketToken } from '@/lib/qr-crypto';
import { normalizeApRegistration, validateApRegistration } from '@/lib/ap-registration';
import { matchToRoute } from '@/lib/route-geometry';

// Global singleton in memory so data persists across Next.js requests in local dev
interface StoreState {
  users: Map<string, UserProfile>;
  stops: Map<string, Stop>;
  routes: Map<string, Route>;
  buses: Map<string, Bus>;
  staff: Map<string, StaffProfile>;
  trips: Map<string, Trip>;
  bookings: Map<string, Booking>;
  tickets: Map<string, Ticket>;
  passes: Map<string, BusPass>;
  scans: BoardingScan[];
  locations: Map<string, GPSLocation>; // keyed by tripId
  disruptions: Map<string, ServiceDisruption>;
  maintenance: MaintenanceRecord[];
  fuel: FuelRecord[];
  incidents: Incident[];
  eventRequests: Map<string, EventRequest>;
  complaints: Map<string, Complaint>;
  notifications: Notification[];
  auditLogs: AuditLog[];
  timetableVersion?: string;
  initialized: boolean;
}

// Global declaration for hot reload preservation
declare global {
  // eslint-disable-next-line no-var
  var __transitStore: StoreState | undefined;
}

// Scheduled routes/stops/trips come only from the official timetable. The legacy demo corridor
// (route-101 etc.) is kept solely as a unit-test fixture and is never loaded outside tests.
function createDefaultFleetBus(codeNum: string, seed: number): Bus {
  const regDigits = String(Math.floor(1000 + (seed * 17)) % 8000 + 1000);
  return {
    id: `bus-fleet-${codeNum.toLowerCase()}`,
    busCode: `BUS-${codeNum}`,
    registrationNumber: `AP39TL${regDigits}`,
    rawRegistration: `AP 39 TL ${regDigits}`,
    vehicleType: 'Standard Campus Coach',
    manufacturer: 'Tata Motors',
    model: 'Starbus Ultra 1623',
    seatingCapacity: 52,
    standingCapacity: 15,
    hasWheelchairAccess: false,
    fuelType: 'diesel',
    status: 'active',
    assignedDepot: 'Amaravati Central Depot',
    currentOdometer: 38400,
    documents: [],
  };
}

function seedTimetable(target: Pick<StoreState, 'stops' | 'routes' | 'trips' | 'buses' | 'staff'>) {
  const official = buildOfficialTransitData();
  official.stops.forEach((st) => target.stops.set(st.id, st));
  official.routes.forEach((r) => target.routes.set(r.id, r));
  official.trips.forEach((t) => {
    const safeTrip = {
      ...t,
      totalSeats: t.totalSeats > 0 ? t.totalSeats : 52,
      bookedSeats: t.bookedSeats || 0,
    };
    target.trips.set(t.id, safeTrip);

    // Auto-create fleet vehicle for this route if not present
    if (t.busId && !target.buses.has(t.busId)) {
      const codeNum = t.route?.routeNumber.replace(/[^a-zA-Z0-9]/g, '') || '01';
      target.buses.set(t.busId, createDefaultFleetBus(codeNum, t.id.charCodeAt(5) || 50));
    }
  });

  if (process.env.NODE_ENV === 'test') {
    SEED_STOPS.forEach((st) => {
      if (!target.stops.has(st.id)) target.stops.set(st.id, st);
    });
    SEED_ROUTES.forEach((r) => {
      target.routes.set(r.id, { ...r, stops: r.stops.map((rs) => ({ ...rs, stop: target.stops.get(rs.stopId) })) });
    });
    SEED_TRIPS.forEach((t) => {
      target.trips.set(t.id, {
        ...t,
        route: target.routes.get(t.routeId),
        bus: target.buses.get(t.busId),
        driver: target.staff.get(t.driverId),
        conductor: target.staff.get(t.conductorId),
      });
    });
  }
}

function getInitialStore(): StoreState {

  if (global.__transitStore) {
    const s = global.__transitStore;
    if (!s.users) {
      s.users = new Map();
      SEED_USERS.forEach((u) => s.users.set(u.id, u));
    }
    // Re-seed timetable data when the cached store predates the current import
    if (!s.routes || s.timetableVersion !== TIMETABLE_DATA_VERSION) {
      s.timetableVersion = TIMETABLE_DATA_VERSION;
      s.stops = new Map();
      s.routes = new Map();
      s.trips = new Map();
      seedTimetable(s);
    }
    if (!s.buses) {
      s.buses = new Map();
      SEED_BUSES.forEach((b) => s.buses.set(b.id, b));
    }
    if (!s.staff) {
      s.staff = new Map();
      SEED_STAFF.forEach((st) => s.staff.set(st.id, st));
    }
    if (!s.bookings) s.bookings = new Map();
    if (!s.tickets) s.tickets = new Map();
    if (!s.passes) {
      s.passes = new Map();
      SEED_BUS_PASSES.forEach((p) => s.passes.set(p.id, p));
    }
    if (!s.scans) s.scans = [];
    if (!s.locations) s.locations = new Map();
    // Drop positions seeded by earlier builds that were not reported by any device
    s.locations.forEach((loc, tripId) => {
      if (loc.id.startsWith('loc-trip-')) s.locations.delete(tripId);
    });
    if (!s.disruptions) {
      s.disruptions = new Map();
      SEED_DISRUPTIONS.forEach((d) => s.disruptions.set(d.id, d));
    }
    if (!s.maintenance) s.maintenance = [...SEED_MAINTENANCE];
    if (!s.fuel) s.fuel = [...SEED_FUEL];
    if (!s.incidents) s.incidents = [...SEED_INCIDENTS];
    if (!s.eventRequests) {
      s.eventRequests = new Map();
      SEED_EVENT_REQUESTS.forEach((e) => s.eventRequests.set(e.id, e));
    }
    if (!s.complaints) {
      s.complaints = new Map();
      SEED_COMPLAINTS.forEach((c) => s.complaints.set(c.id, c));
    }
    if (!s.notifications) s.notifications = [...SEED_NOTIFICATIONS];
    if (!s.auditLogs) s.auditLogs = [];

    return s;
  }

  const store: StoreState = {
    users: new Map(),
    stops: new Map(),
    routes: new Map(),
    buses: new Map(),
    staff: new Map(),
    trips: new Map(),
    bookings: new Map(),
    tickets: new Map(),
    passes: new Map(),
    scans: [],
    locations: new Map(),
    disruptions: new Map(),
    maintenance: [...SEED_MAINTENANCE],
    fuel: [...SEED_FUEL],
    incidents: [...SEED_INCIDENTS],
    eventRequests: new Map(),
    complaints: new Map(),
    notifications: [...SEED_NOTIFICATIONS],
    auditLogs: [],
    initialized: false,
    timetableVersion: TIMETABLE_DATA_VERSION,
  };

  // Seed Users
  SEED_USERS.forEach((u) => store.users.set(u.id, u));

  // Seed Buses & Staff
  SEED_BUSES.forEach((b) => store.buses.set(b.id, b));
  SEED_STAFF.forEach((s) => store.staff.set(s.id, s));

  seedTimetable(store);

  // Seed Bus Passes
  SEED_BUS_PASSES.forEach((p) => store.passes.set(p.id, p));

  // Seed Disruptions
  SEED_DISRUPTIONS.forEach((d) => store.disruptions.set(d.id, d));

  // Seed Event Requests
  SEED_EVENT_REQUESTS.forEach((e) => store.eventRequests.set(e.id, e));

  // Seed Complaints
  SEED_COMPLAINTS.forEach((c) => store.complaints.set(c.id, c));

  // No live locations are seeded: positions only come from authenticated device reports
  global.__transitStore = store;
  return store;
}

export const store = getInitialStore();

// Initialize sample bookings & tickets asynchronously
async function ensureSeedTickets() {
  if (store.initialized) return;

  for (const b of SEED_BOOKINGS) {
    const trip = store.trips.get(b.tripId);
    if (!trip) continue;
    const originStop = store.stops.get(b.originStopId);
    const destinationStop = store.stops.get(b.destinationStopId);

    const ticketId = `tkt-${b.id}`;
    const token = generateTicketToken({
      tId: ticketId,
      bId: b.id,
      trId: b.tripId,
      rId: trip?.routeId || '',
      exp: Math.floor(Date.now() / 1000) + 86400 * 2, // 2 days validity
      nonce: Math.random().toString(36).substring(2, 8),
    });

    const qrCodeDataUrl = await generateQrCodeDataUrl(token);

    const ticket: Ticket = {
      id: ticketId,
      ticketNumber: `VIT-TKT-${b.id.replace('book-', '')}`,
      token,
      bookingId: b.id,
      qrCodeDataUrl,
      status: 'valid',
      validityStart: new Date().toISOString(),
      validityEnd: new Date(Date.now() + 86400000 * 2).toISOString(),
    };

    store.tickets.set(ticket.id, ticket);
    store.bookings.set(b.id, {
      ...b,
      trip,
      originStop,
      destinationStop,
      ticket,
    });
  }

  store.initialized = true;
}

// Trigger ticket generation
ensureSeedTickets().catch(console.error);

// ----------------- Data Access Methods -----------------

export async function getStops(): Promise<Stop[]> {
  await ensureSeedTickets();
  return Array.from(store.stops.values());
}

export async function getStopById(id: string): Promise<Stop | undefined> {
  await ensureSeedTickets();
  return store.stops.get(id);
}

export async function createStop(stopData: Omit<Stop, 'id' | 'createdAt'>): Promise<Stop> {
  const existing = Array.from(store.stops.values()).find((s) => s.code.toUpperCase() === stopData.code.toUpperCase());
  if (existing) {
    throw new Error(`Stop code "${stopData.code}" already exists.`);
  }

  const id = `stop-${Date.now()}`;
  const stop: Stop = {
    ...stopData,
    id,
    createdAt: new Date().toISOString(),
  };

  store.stops.set(id, stop);
  return stop;
}

export async function getRoutes(): Promise<Route[]> {
  await ensureSeedTickets();
  return Array.from(store.routes.values()).filter((r) => !r.id.includes('101'));
}

export async function getRouteById(id: string): Promise<Route | undefined> {
  await ensureSeedTickets();
  const route = store.routes.get(id);
  if (route) return route;
  if (id === 'route-101' || id === 'route-101R') {
    return store.routes.get('route-vv-1') || Array.from(store.routes.values())[0];
  }
  return undefined;
}

export async function createRoute(routeData: Omit<Route, 'id'>): Promise<Route> {
  const id = `route-${Date.now()}`;
  const populatedStops = routeData.stops.map((rs) => ({
    ...rs,
    stop: store.stops.get(rs.stopId),
  }));

  const newRoute: Route = {
    ...routeData,
    id,
    stops: populatedStops,
  };

  store.routes.set(id, newRoute);
  return newRoute;
}

export async function getBuses(): Promise<Bus[]> {
  await ensureSeedTickets();
  return Array.from(store.buses.values());
}

export async function getBusById(id: string): Promise<Bus | undefined> {
  await ensureSeedTickets();
  return store.buses.get(id);
}

export async function createBus(busData: {
  busCode: string;
  rawRegistration: string;
  vehicleType: string;
  model: string;
  manufacturer: string;
  seatingCapacity: number;
  standingCapacity: number;
  hasWheelchairAccess: boolean;
  fuelType: 'diesel' | 'cng' | 'electric' | 'hybrid';
  assignedDepot: string;
  adminOverride?: boolean;
}): Promise<Bus> {
  const regValidation = validateApRegistration(busData.rawRegistration, false, busData.adminOverride);
  if (!regValidation.isValid) {
    throw new Error(regValidation.errorMessage || 'Invalid registration number');
  }

  // Duplicate Check against normalized registration
  const duplicate = Array.from(store.buses.values()).find(
    (b) => b.registrationNumber === regValidation.normalized
  );
  if (duplicate) {
    throw new Error(`A vehicle with registration "${regValidation.formatted}" is already registered (Bus ID: ${duplicate.busCode}).`);
  }

  // Check unique busCode
  const dupCode = Array.from(store.buses.values()).find(
    (b) => b.busCode.toUpperCase() === busData.busCode.toUpperCase()
  );
  if (dupCode) {
    throw new Error(`Internal Bus Code "${busData.busCode}" is already in use.`);
  }

  const id = `bus-${Date.now()}`;
  const newBus: Bus = {
    id,
    busCode: busData.busCode.toUpperCase(),
    registrationNumber: regValidation.normalized,
    rawRegistration: busData.rawRegistration,
    vehicleType: busData.vehicleType,
    model: busData.model,
    manufacturer: busData.manufacturer,
    seatingCapacity: Number(busData.seatingCapacity),
    standingCapacity: Number(busData.standingCapacity || 0),
    hasWheelchairAccess: Boolean(busData.hasWheelchairAccess),
    fuelType: busData.fuelType,
    status: 'active',
    assignedDepot: busData.assignedDepot,
    currentOdometer: 0,
    documents: [],
  };

  store.buses.set(id, newBus);
  return newBus;
}

export async function updateBusStatus(busId: string, status: Bus['status']): Promise<Bus> {
  const bus = store.buses.get(busId);
  if (!bus) throw new Error('Bus not found');
  bus.status = status;
  store.buses.set(busId, bus);
  return bus;
}

export async function getTrips(): Promise<Trip[]> {
  await ensureSeedTickets();
  return Array.from(store.trips.values())
    .filter((t) => !t.id.includes('101'))
    .map((t) => {
      const route = store.routes.get(t.routeId);
      const codeNum = route?.routeNumber ? route.routeNumber.replace(/[^a-zA-Z0-9]/g, '') : '01';
      return {
        ...t,
        totalSeats: t.totalSeats > 0 ? t.totalSeats : 52,
        bookedSeats: t.bookedSeats || 0,
        route,
        bus: store.buses.get(t.busId) || createDefaultFleetBus(codeNum, t.id.charCodeAt(5) || 50),
        driver: store.staff.get(t.driverId) || store.staff.get('staff-drv-1'),
        conductor: store.staff.get(t.conductorId) || store.staff.get('staff-cnd-1'),
      };
    });
}

export async function getTripById(id: string): Promise<Trip | undefined> {
  await ensureSeedTickets();
  const trip = store.trips.get(id) ||
    (id === 'trip-101-morning' ? store.trips.get('trip-vv-1-morning') : undefined) ||
    (id === 'trip-101-midday' ? store.trips.get('trip-vv-4-morning') : undefined);
  if (!trip) return undefined;
  const route = store.routes.get(trip.routeId);
  const codeNum = route?.routeNumber ? route.routeNumber.replace(/[^a-zA-Z0-9]/g, '') : '01';
  return {
    ...trip,
    totalSeats: trip.totalSeats > 0 ? trip.totalSeats : 52,
    bookedSeats: trip.bookedSeats || 0,
    route,
    bus: store.buses.get(trip.busId) || createDefaultFleetBus(codeNum, trip.id.charCodeAt(5) || 50),
    driver: store.staff.get(trip.driverId) || store.staff.get('staff-drv-1'),
    conductor: store.staff.get(trip.conductorId) || store.staff.get('staff-cnd-1'),
  };
}

export async function createTrip(tripData: {
  routeId: string;
  busId: string;
  driverId: string;
  conductorId: string;
  travelDate: string;
  departureTime: string;
  arrivalTime: string;
  operationalNotes?: string;
}): Promise<Trip> {
  const bus = store.buses.get(tripData.busId);
  if (!bus) throw new Error('Vehicle not found.');
  if (bus.status !== 'active') {
    throw new Error(`Vehicle ${bus.registrationNumber} is currently in "${bus.status}" status and cannot be assigned.`);
  }

  const driver = store.staff.get(tripData.driverId);
  if (!driver || driver.status !== 'active') {
    throw new Error('Driver is not active or available.');
  }

  // Prevent conflicting active trips for same bus or driver at the same date/time
  const conflict = Array.from(store.trips.values()).find(
    (t) =>
      t.travelDate === tripData.travelDate &&
      t.departureTime === tripData.departureTime &&
      (t.busId === tripData.busId || t.driverId === tripData.driverId) &&
      t.status !== 'cancelled' &&
      t.status !== 'completed'
  );
  if (conflict) {
    throw new Error('Scheduling conflict: The selected vehicle or driver is already assigned to a trip at this date and time.');
  }

  const id = `trip-${Date.now()}`;
  const route = store.routes.get(tripData.routeId);
  const conductor = store.staff.get(tripData.conductorId);

  const newTrip: Trip = {
    id,
    routeId: tripData.routeId,
    busId: tripData.busId,
    driverId: tripData.driverId,
    conductorId: tripData.conductorId,
    travelDate: tripData.travelDate,
    departureTime: tripData.departureTime,
    arrivalTime: tripData.arrivalTime,
    status: 'scheduled',
    totalSeats: bus.seatingCapacity,
    bookedSeats: 0,
    operationalNotes: tripData.operationalNotes,
    route,
    bus,
    driver,
    conductor,
  };

  store.trips.set(id, newTrip);
  return newTrip;
}

export async function updateTripStatus(tripId: string, status: Trip['status']): Promise<Trip> {
  const trip = store.trips.get(tripId);
  if (!trip) throw new Error('Trip not found');
  trip.status = status;
  store.trips.set(tripId, trip);
  return trip;
}

export async function getStaff(): Promise<StaffProfile[]> {
  await ensureSeedTickets();
  return Array.from(store.staff.values());
}

export async function getBookingsForUser(userId: string): Promise<Booking[]> {
  await ensureSeedTickets();
  const all = Array.from(store.bookings.values()).filter((b) => b.userId === userId);
  return all.map((b) => ({
    ...b,
    trip: store.trips.get(b.tripId),
    originStop: store.stops.get(b.originStopId),
    destinationStop: store.stops.get(b.destinationStopId),
    ticket: store.tickets.get(`tkt-${b.id}`),
  }));
}

export async function getBookingById(id: string): Promise<Booking | undefined> {
  await ensureSeedTickets();
  const b = store.bookings.get(id);
  if (!b) return undefined;
  return {
    ...b,
    trip: store.trips.get(b.tripId),
    originStop: store.stops.get(b.originStopId),
    destinationStop: store.stops.get(b.destinationStopId),
    ticket: store.tickets.get(`tkt-${b.id}`),
  };
}

/**
 * Atomic reservation creation with strict capacity validation.
 */
export async function createBooking(data: {
  userId: string;
  tripId: string;
  passengerName: string;
  passengerEmail: string;
  passengerPhone: string;
  passengerType: 'student' | 'faculty' | 'visitor' | 'staff';
  originStopId: string;
  destinationStopId: string;
  seatCount: number;
}): Promise<Booking> {
  await ensureSeedTickets();
  const trip = store.trips.get(data.tripId);
  if (!trip) {
    throw new Error('Trip not found.');
  }

  if (trip.status !== 'scheduled' && trip.status !== 'boarding') {
    throw new Error(`Trip is in "${trip.status}" state and no longer accepting reservations.`);
  }

  // Ensure positive seat capacity
  if (!trip.totalSeats || trip.totalSeats <= 0) {
    trip.totalSeats = 52;
  }

  // Atomic capacity check
  const availableSeats = trip.totalSeats - trip.bookedSeats;
  if (data.seatCount > availableSeats) {
    throw new Error(`Cannot reserve ${data.seatCount} seat(s). Only ${availableSeats} seat(s) remaining on this service.`);
  }

  // Increment booked seats atomically
  trip.bookedSeats += data.seatCount;
  store.trips.set(trip.id, trip);

  const bookingId = `book-${Date.now()}`;
  const bookingReference = `VIT-BK-${Math.floor(10000 + Math.random() * 90000)}`;

  const route = store.routes.get(trip.routeId);
  const fareAmount = (route?.fareAmount || 0) * data.seatCount;

  const ticketId = `tkt-${bookingId}`;
  const token = generateTicketToken({
    tId: ticketId,
    bId: bookingId,
    trId: trip.id,
    rId: trip.routeId,
    exp: Math.floor(Date.now() / 1000) + 86400 * 2,
    nonce: Math.random().toString(36).substring(2, 8),
  });

  const qrCodeDataUrl = await generateQrCodeDataUrl(token);

  const ticket: Ticket = {
    id: ticketId,
    ticketNumber: `VIT-TKT-${bookingReference.replace('VIT-BK-', '')}`,
    token,
    bookingId,
    qrCodeDataUrl,
    status: 'valid',
    validityStart: new Date().toISOString(),
    validityEnd: new Date(Date.now() + 86400000 * 2).toISOString(),
  };

  store.tickets.set(ticket.id, ticket);

  const newBooking: Booking = {
    id: bookingId,
    bookingReference,
    userId: data.userId,
    tripId: data.tripId,
    passengerName: data.passengerName,
    passengerEmail: data.passengerEmail,
    passengerPhone: data.passengerPhone,
    passengerType: data.passengerType,
    originStopId: data.originStopId,
    destinationStopId: data.destinationStopId,
    seatCount: data.seatCount,
    fareAmount,
    status: 'confirmed',
    bookedAt: new Date().toISOString(),
    trip,
    ticket,
    originStop: store.stops.get(data.originStopId),
    destinationStop: store.stops.get(data.destinationStopId),
  };

  store.bookings.set(bookingId, newBooking);

  // Add confirmation notification
  store.notifications.unshift({
    id: `notif-${Date.now()}`,
    userId: data.userId,
    title: `Ticket Issued: ${bookingReference}`,
    message: `Your booking for ${data.passengerName} on trip ${trip.departureTime} has been confirmed. View QR ticket in your wallet.`,
    type: 'booking',
    isRead: false,
    createdAt: new Date().toISOString(),
    link: '/tickets',
  });

  return newBooking;
}

export async function cancelBooking(bookingId: string, userId: string): Promise<Booking> {
  const booking = store.bookings.get(bookingId);
  if (!booking) throw new Error('Booking not found');
  if (booking.userId !== userId) throw new Error('Unauthorized to cancel this booking');
  if (booking.status === 'cancelled') throw new Error('Booking is already cancelled');

  // Decrement trip booked seats
  const trip = store.trips.get(booking.tripId);
  if (trip) {
    trip.bookedSeats = Math.max(0, trip.bookedSeats - booking.seatCount);
    store.trips.set(trip.id, trip);
  }

  // Invalidate ticket
  const ticket = store.tickets.get(`tkt-${bookingId}`);
  if (ticket) {
    ticket.status = 'cancelled';
    store.tickets.set(ticket.id, ticket);
  }

  booking.status = 'cancelled';
  store.bookings.set(bookingId, booking);
  return booking;
}

/**
 * Atomic Server-side QR Ticket Validation & Boarding Scan.
 * Strictly prevents duplicate boarding scans and enforces trip validity.
 */
export async function validateAndConsumeTicket(data: {
  token: string;
  tripId: string;
  scannedByStaffId: string;
  deviceFingerprint?: string;
}): Promise<BoardingScan> {
  await ensureSeedTickets();

  const scanId = `scan-${Date.now()}`;
  const now = new Date().toISOString();

  // 1. Verify cryptographic token signature
  const tokenCheck = verifyTicketToken(data.token);
  if (!tokenCheck.isValid || !tokenCheck.payload) {
    const failedScan: BoardingScan = {
      id: scanId,
      ticketId: 'UNKNOWN',
      tripId: data.tripId,
      scannedByStaffId: data.scannedByStaffId,
      scannedAt: now,
      scanResult: 'invalid',
      notes: tokenCheck.error || 'Token cryptographic verification failed',
      deviceFingerprint: data.deviceFingerprint,
    };
    store.scans.unshift(failedScan);
    return failedScan;
  }

  const { tId, bId, trId } = tokenCheck.payload;

  // 2. Fetch ticket from authoritative store
  const ticket = store.tickets.get(tId);
  const booking = store.bookings.get(bId);

  if (!ticket || !booking) {
    const notFoundScan: BoardingScan = {
      id: scanId,
      ticketId: tId,
      tripId: data.tripId,
      scannedByStaffId: data.scannedByStaffId,
      scannedAt: now,
      scanResult: 'invalid',
      notes: 'Authoritative ticket record does not exist on server.',
    };
    store.scans.unshift(notFoundScan);
    return notFoundScan;
  }

  // 3. Check if ticket is cancelled
  if (ticket.status === 'cancelled' || booking.status === 'cancelled') {
    const cancelledScan: BoardingScan = {
      id: scanId,
      ticketId: tId,
      tripId: data.tripId,
      scannedByStaffId: data.scannedByStaffId,
      scannedAt: now,
      scanResult: 'cancelled',
      notes: 'This booking was cancelled by the passenger or administrator.',
      passengerName: booking.passengerName,
      ticketNumber: ticket.ticketNumber,
    };
    store.scans.unshift(cancelledScan);
    return cancelledScan;
  }

  // 4. Duplicate scan protection: check if already consumed
  if (ticket.status === 'used') {
    const duplicateScan: BoardingScan = {
      id: scanId,
      ticketId: tId,
      tripId: data.tripId,
      scannedByStaffId: data.scannedByStaffId,
      scannedAt: now,
      scanResult: 'already_used',
      notes: `Ticket was already scanned and boarded at ${ticket.boardedAt || 'earlier time'} by staff ${ticket.validatedBy || 'validator'}.`,
      passengerName: booking.passengerName,
      ticketNumber: ticket.ticketNumber,
    };
    store.scans.unshift(duplicateScan);
    return duplicateScan;
  }

  // 5. Trip match verification
  if (trId !== data.tripId) {
    const wrongTripScan: BoardingScan = {
      id: scanId,
      ticketId: tId,
      tripId: data.tripId,
      scannedByStaffId: data.scannedByStaffId,
      scannedAt: now,
      scanResult: 'wrong_trip',
      notes: `Ticket is issued for Trip ID "${trId}", but scanned on Trip ID "${data.tripId}".`,
      passengerName: booking.passengerName,
      ticketNumber: ticket.ticketNumber,
    };
    store.scans.unshift(wrongTripScan);
    return wrongTripScan;
  }

  // 6. Atomic Consumption: mark ticket and booking as USED
  ticket.status = 'used';
  ticket.boardedAt = now;
  ticket.validatedBy = data.scannedByStaffId;
  store.tickets.set(ticket.id, ticket);

  booking.status = 'used';
  store.bookings.set(booking.id, booking);

  const successfulScan: BoardingScan = {
    id: scanId,
    ticketId: tId,
    tripId: data.tripId,
    scannedByStaffId: data.scannedByStaffId,
    scannedAt: now,
    scanResult: 'valid',
    notes: 'Passenger validated and boarded successfully.',
    passengerName: booking.passengerName,
    ticketNumber: ticket.ticketNumber,
  };

  store.scans.unshift(successfulScan);
  return successfulScan;
}

export async function getScansForTrip(tripId: string): Promise<BoardingScan[]> {
  await ensureSeedTickets();
  return store.scans.filter((s) => s.tripId === tripId);
}

// ----------------- Live GPS Location Ingestion -----------------

export class LocationRejectedError extends Error {}

// Device clocks may drift a little ahead; anything further in the future is rejected
const MAX_FUTURE_SKEW_MS = 30_000;
// Reports older than this when received are not treated as the current position
const MAX_REPORT_AGE_MS = 10 * 60_000;

/**
 * Records a GPS observation reported by a bus's device. Validates the values, ignores reports older
 * than the latest accepted one, and matches the observation against the trip's planned road path.
 * The raw observation is stored as-is; the matched position is stored separately.
 */
export async function updateLiveLocation(data: {
  tripId: string;
  busId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speedKmH?: number;
  heading?: number;
  accuracyMeters: number;
  recordedAt?: string; // device timestamp (ISO); defaults to receipt time
}): Promise<GPSLocation> {
  const { latitude, longitude, accuracyMeters } = data;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new LocationRejectedError('Invalid latitude/longitude.');
  }
  if (latitude === 0 && longitude === 0) throw new LocationRejectedError('Null-island coordinate rejected.');
  if (!Number.isFinite(accuracyMeters) || accuracyMeters <= 0) throw new LocationRejectedError('accuracyMeters must be a positive number.');
  const speed = data.speedKmH;
  if (speed !== undefined && (!Number.isFinite(speed) || speed < 0 || speed > 150)) {
    throw new LocationRejectedError('speedKmH must be between 0 and 150.');
  }
  const heading = data.heading;
  if (heading !== undefined && (!Number.isFinite(heading) || heading < 0 || heading >= 360)) {
    throw new LocationRejectedError('heading must be in [0, 360).');
  }

  const now = Date.now();
  const recordedMs = data.recordedAt ? Date.parse(data.recordedAt) : now;
  if (!Number.isFinite(recordedMs)) throw new LocationRejectedError('recordedAt is not a valid timestamp.');
  if (recordedMs - now > MAX_FUTURE_SKEW_MS) throw new LocationRejectedError('recordedAt is in the future.');
  if (now - recordedMs > MAX_REPORT_AGE_MS) throw new LocationRejectedError('recordedAt is too old to be a current position.');

  const previous = store.locations.get(data.tripId);
  if (previous && Date.parse(previous.timestamp) >= recordedMs) {
    // Out-of-order delivery: keep the newer position already stored
    return previous;
  }

  const trip = store.trips.get(data.tripId);
  const route = trip ? store.routes.get(trip.routeId) : undefined;
  const line = route?.geometry && route.geometry.status !== 'unavailable' ? route.geometry.coordinates : undefined;
  const match = matchToRoute(
    { latitude, longitude, accuracyMeters, speedKmH: speed, heading },
    line,
    previous?.matchStatus === 'on_route' ? previous.alongRouteM : undefined
  );

  const loc: GPSLocation = {
    id: `loc-${data.tripId}-${recordedMs}`,
    tripId: data.tripId,
    busId: data.busId,
    driverId: data.driverId,
    latitude,
    longitude,
    speedKmH: speed !== undefined ? Math.round(speed) : NaN,
    heading: heading !== undefined ? Math.round(heading) : NaN,
    accuracyMeters: Math.round(accuracyMeters),
    timestamp: new Date(recordedMs).toISOString(),
    isLive: true,
    source: 'device',
    matchStatus: match.status,
    matchedLatitude: match.matched?.[0],
    matchedLongitude: match.matched?.[1],
    routeOffsetM: match.offsetM !== undefined ? Math.round(match.offsetM) : undefined,
    alongRouteM: match.alongM !== undefined ? Math.round(match.alongM) : undefined,
  };

  store.locations.set(data.tripId, loc);
  return loc;
}

export async function getLiveLocationForTrip(tripId: string): Promise<GPSLocation | undefined> {
  const loc = store.locations.get(tripId);
  if (!loc) return undefined;

  // Stale check: if last update is > 2 minutes old (120,000 ms), mark isLive = false
  const ageMs = Date.now() - new Date(loc.timestamp).getTime();
  return {
    ...loc,
    isLive: ageMs < 120000,
  };
}

export async function getAllLiveLocations(): Promise<GPSLocation[]> {
  const list: GPSLocation[] = [];
  const now = Date.now();
  for (const loc of store.locations.values()) {
    const ageMs = now - new Date(loc.timestamp).getTime();
    list.push({
      ...loc,
      isLive: ageMs < 120000,
    });
  }
  return list;
}

// ----------------- Disruptions -----------------

export async function getDisruptions(): Promise<ServiceDisruption[]> {
  return Array.from(store.disruptions.values());
}

export async function createDisruption(data: Omit<ServiceDisruption, 'id'>): Promise<ServiceDisruption> {
  const id = `disrupt-${Date.now()}`;
  const disruption: ServiceDisruption = {
    ...data,
    id,
  };
  store.disruptions.set(id, disruption);
  return disruption;
}

// ----------------- Maintenance & Fuel -----------------

export async function getMaintenanceRecords(): Promise<MaintenanceRecord[]> {
  return [...store.maintenance];
}

export async function createMaintenanceRecord(data: Omit<MaintenanceRecord, 'id'>): Promise<MaintenanceRecord> {
  const id = `maint-${Date.now()}`;
  const record: MaintenanceRecord = { ...data, id };
  store.maintenance.unshift(record);

  // If breakdown or scheduled, update bus status
  if (data.status === 'in_progress') {
    const bus = store.buses.get(data.busId);
    if (bus) {
      bus.status = 'maintenance';
      store.buses.set(bus.id, bus);
    }
  }

  return record;
}

export async function getFuelRecords(): Promise<FuelRecord[]> {
  return [...store.fuel];
}

export async function createFuelRecord(data: Omit<FuelRecord, 'id'>): Promise<FuelRecord> {
  const id = `fuel-${Date.now()}`;
  const record: FuelRecord = { ...data, id };
  store.fuel.unshift(record);
  return record;
}

// ----------------- Incidents -----------------

export async function getIncidents(): Promise<Incident[]> {
  return [...store.incidents];
}

export async function createIncident(data: Omit<Incident, 'id'>): Promise<Incident> {
  const id = `inc-${Date.now()}`;
  const incident: Incident = { ...data, id };
  store.incidents.unshift(incident);
  return incident;
}

// ----------------- Events -----------------

export async function getEventRequests(): Promise<EventRequest[]> {
  return Array.from(store.eventRequests.values());
}

export async function createEventRequest(data: Omit<EventRequest, 'id' | 'status' | 'approvedBusIds' | 'submittedAt'>): Promise<EventRequest> {
  const id = `ev-req-${Date.now()}`;
  const req: EventRequest = {
    ...data,
    id,
    status: 'pending',
    approvedBusIds: [],
    submittedAt: new Date().toISOString(),
  };
  store.eventRequests.set(id, req);
  return req;
}

export async function updateEventRequestStatus(
  id: string,
  status: EventRequest['status'],
  approvedBusIds: string[] = [],
  notes?: string
): Promise<EventRequest> {
  const req = store.eventRequests.get(id);
  if (!req) throw new Error('Event request not found');
  req.status = status;
  req.approvedBusIds = approvedBusIds;
  if (notes) req.notes = notes;
  store.eventRequests.set(id, req);
  return req;
}

// ----------------- Complaints -----------------

export async function getComplaints(): Promise<Complaint[]> {
  return Array.from(store.complaints.values());
}

export async function getComplaintsForUser(userId: string): Promise<Complaint[]> {
  return Array.from(store.complaints.values()).filter((c) => c.userId === userId);
}

export async function getComplaintById(id: string): Promise<Complaint | undefined> {
  return store.complaints.get(id);
}

export async function createComplaint(data: {
  userId: string;
  passengerName: string;
  category: Complaint['category'];
  tripId?: string;
  busId?: string;
  description: string;
  priority?: Complaint['priority'];
}): Promise<Complaint> {
  const id = `comp-${Date.now()}`;
  const caseNumber = `CASE-2026-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString();

  const complaint: Complaint = {
    id,
    caseNumber,
    userId: data.userId,
    passengerName: data.passengerName,
    category: data.category,
    tripId: data.tripId,
    busId: data.busId,
    description: data.description,
    priority: data.priority || 'medium',
    status: 'submitted',
    submittedAt: now,
    messages: [
      {
        id: `msg-${Date.now()}`,
        complaintId: id,
        senderId: data.userId,
        senderName: data.passengerName,
        senderRole: 'student',
        message: data.description,
        sentAt: now,
        isInternal: false,
      },
    ],
  };

  store.complaints.set(id, complaint);
  return complaint;
}

export async function addComplaintMessage(data: {
  complaintId: string;
  senderId: string;
  senderName: string;
  senderRole: UserProfile['role'];
  message: string;
  isInternal?: boolean;
}): Promise<ComplaintMessage> {
  const comp = store.complaints.get(data.complaintId);
  if (!comp) throw new Error('Complaint not found');

  const msg: ComplaintMessage = {
    id: `msg-${Date.now()}`,
    complaintId: data.complaintId,
    senderId: data.senderId,
    senderName: data.senderName,
    senderRole: data.senderRole,
    message: data.message,
    sentAt: new Date().toISOString(),
    isInternal: Boolean(data.isInternal),
  };

  comp.messages.push(msg);
  store.complaints.set(comp.id, comp);
  return msg;
}

export async function updateComplaintStatus(
  id: string,
  status: Complaint['status'],
  resolutionNotes?: string
): Promise<Complaint> {
  const comp = store.complaints.get(id);
  if (!comp) throw new Error('Complaint not found');
  comp.status = status;
  if (resolutionNotes) comp.resolutionNotes = resolutionNotes;
  if (status === 'resolved') comp.resolvedAt = new Date().toISOString();
  store.complaints.set(id, comp);
  return comp;
}

// ----------------- Notifications -----------------

export async function getNotifications(userId: string): Promise<Notification[]> {
  return store.notifications.filter((n) => n.userId === userId);
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const notif = store.notifications.find((n) => n.id === id);
  if (notif) notif.isRead = true;
}

// ----------------- Boarding Scans & Audit Logs -----------------

export async function getAllScans(): Promise<BoardingScan[]> {
  await ensureSeedTickets();
  return store.scans;
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  if (store.auditLogs.length === 0) {
    store.auditLogs = [
      {
        id: 'audit-001',
        action: 'ROUTE_PUBLISHED',
        entityType: 'route',
        entityId: 'route-101',
        performedBy: 'usr-admin-01',
        details: { routeNumber: '101', corridor: 'Vijayawada Junction to Amaravati' },
        timestamp: '2026-10-28T05:30:00.000Z',
      },
      {
        id: 'audit-002',
        action: 'VEHICLE_REGISTERED',
        entityType: 'bus',
        entityId: 'bus-01',
        performedBy: 'usr-admin-01',
        details: { apRegNumber: 'AP 39 TL 1001', rtoCode: 'AP39', rtoDistrict: 'Tirupati' },
        timestamp: '2026-10-28T05:45:00.000Z',
      },
      {
        id: 'audit-003',
        action: 'DISRUPTION_BROADCAST',
        entityType: 'service_disruption',
        entityId: 'disrupt-01',
        performedBy: 'usr-admin-01',
        details: { title: 'Prakasam Barrage Bridge Roadworks Diversion', severity: 'moderate' },
        timestamp: '2026-10-28T06:00:00.000Z',
      },
      {
        id: 'audit-004',
        action: 'TRIP_DISPATCHED',
        entityType: 'trip',
        entityId: 'trip-101-morning',
        performedBy: 'usr-admin-01',
        details: { departure: '07:15', vehicle: 'AP 39 TL 1001', driver: 'K. Rama Rao' },
        timestamp: '2026-10-28T06:30:00.000Z',
      },
      {
        id: 'audit-005',
        action: 'BOARDING_SCAN_VALIDATED',
        entityType: 'boarding_scan',
        entityId: 'scan-init-01',
        performedBy: 'usr-conductor-01',
        details: { ticketNumber: 'TKT-VITAP-101-01', result: 'valid', passenger: 'Aarav Sharma' },
        timestamp: '2026-10-28T07:10:00.000Z',
      },
    ];
  }
  return store.auditLogs;
}

export async function addAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
  const log: AuditLog = {
    ...entry,
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
  store.auditLogs.unshift(log);
  return log;
}

// ----------------- Student Bus Passes -----------------

export async function getBusPassForUser(userId: string): Promise<BusPass | undefined> {
  await ensureSeedTickets();
  if (!store.passes) {
    store.passes = new Map();
    SEED_BUS_PASSES.forEach((p) => store.passes.set(p.id, p));
  }
  const passes = Array.from(store.passes.values());
  const pass = passes.find((p) => p.userId === userId && p.status === 'active');
  if (pass && !pass.qrCodeDataUrl) {
    try {
      const token = generateTicketToken({
        tId: pass.id,
        bId: pass.passNumber,
        trId: pass.routeId,
        rId: pass.routeNumber,
        exp: new Date(pass.validUntil).getTime(),
        nonce: Math.random().toString(36).substring(2, 10),
      });
      pass.qrCodeDataUrl = await generateQrCodeDataUrl(token);
    } catch {
      // Fallback
    }
  }
  return pass;
}

export async function getBusPassById(id: string): Promise<BusPass | undefined> {
  await ensureSeedTickets();
  if (!store.passes) {
    store.passes = new Map();
    SEED_BUS_PASSES.forEach((p) => store.passes.set(p.id, p));
  }
  const pass = store.passes.get(id);
  if (pass && !pass.qrCodeDataUrl) {
    try {
      const token = generateTicketToken({
        tId: pass.id,
        bId: pass.passNumber,
        trId: pass.routeId,
        rId: pass.routeNumber,
        exp: new Date(pass.validUntil).getTime(),
        nonce: Math.random().toString(36).substring(2, 10),
      });
      pass.qrCodeDataUrl = await generateQrCodeDataUrl(token);
    } catch {
      // Fallback
    }
  }
  return pass;
}

export async function getAllBusPasses(): Promise<BusPass[]> {
  await ensureSeedTickets();
  if (!store.passes) {
    store.passes = new Map();
    SEED_BUS_PASSES.forEach((p) => store.passes.set(p.id, p));
  }
  return Array.from(store.passes.values());
}

export async function createBusPass(data: Omit<BusPass, 'id' | 'passNumber' | 'issuedAt'>): Promise<BusPass> {
  await ensureSeedTickets();
  if (!store.passes) {
    store.passes = new Map();
    SEED_BUS_PASSES.forEach((p) => store.passes.set(p.id, p));
  }
  const id = `pass-${Date.now()}`;
  const passNumber = `VITAP/BP/2026/${Math.floor(1000 + Math.random() * 9000)}`;
  const pass: BusPass = {
    ...data,
    id,
    passNumber,
    issuedAt: new Date().toISOString(),
  };

  try {
    const token = generateTicketToken({
      tId: pass.id,
      bId: pass.passNumber,
      trId: pass.routeId,
      rId: pass.routeNumber,
      exp: new Date(pass.validUntil).getTime(),
      nonce: Math.random().toString(36).substring(2, 10),
    });
    pass.qrCodeDataUrl = await generateQrCodeDataUrl(token);
  } catch {
    // QR generation fallback
  }

  store.passes.set(id, pass);
  return pass;
}

export async function updateUserPreferences(
  userId: string,
  data: { preferredRouteId?: string; preferredStopId?: string }
): Promise<UserProfile> {
  const user = store.users.get(userId);
  if (!user) throw new Error('User not found');
  if (data.preferredRouteId !== undefined) user.preferredRouteId = data.preferredRouteId;
  if (data.preferredStopId !== undefined) user.preferredStopId = data.preferredStopId;
  store.users.set(userId, user);
  return user;
}


