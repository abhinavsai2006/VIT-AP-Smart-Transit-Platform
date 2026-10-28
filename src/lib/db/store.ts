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
} from '@/lib/seed-data';

import { generateTicketToken, generateQrCodeDataUrl, verifyTicketToken } from '@/lib/qr-crypto';
import { normalizeApRegistration, validateApRegistration } from '@/lib/ap-registration';

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
  initialized: boolean;
}

// Global declaration for hot reload preservation
declare global {
  // eslint-disable-next-line no-var
  var __transitStore: StoreState | undefined;
}

function getInitialStore(): StoreState {
  if (global.__transitStore) {
    return global.__transitStore;
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
  };

  // Seed Users
  SEED_USERS.forEach((u) => store.users.set(u.id, u));

  // Seed Stops
  SEED_STOPS.forEach((s) => store.stops.set(s.id, s));

  // Seed Routes
  SEED_ROUTES.forEach((r) => {
    // Populate stop reference in route.stops
    const populatedStops = r.stops.map((rs) => ({
      ...rs,
      stop: store.stops.get(rs.stopId),
    }));
    store.routes.set(r.id, { ...r, stops: populatedStops });
  });

  // Seed Buses
  SEED_BUSES.forEach((b) => store.buses.set(b.id, b));

  // Seed Staff
  SEED_STAFF.forEach((s) => store.staff.set(s.id, s));

  // Seed Trips
  SEED_TRIPS.forEach((t) => {
    const route = store.routes.get(t.routeId);
    const bus = store.buses.get(t.busId);
    const driver = store.staff.get(t.driverId);
    const conductor = store.staff.get(t.conductorId);
    store.trips.set(t.id, { ...t, route, bus, driver, conductor });
  });

  // Seed Disruptions
  SEED_DISRUPTIONS.forEach((d) => store.disruptions.set(d.id, d));

  // Seed Event Requests
  SEED_EVENT_REQUESTS.forEach((e) => store.eventRequests.set(e.id, e));

  // Seed Complaints
  SEED_COMPLAINTS.forEach((c) => store.complaints.set(c.id, c));

  // Initialize initial live GPS for trip-101-morning (between Mangalagiri and VIT-AP Campus)
  store.locations.set('trip-101-morning', {
    id: 'loc-trip-101-1',
    tripId: 'trip-101-morning',
    busId: 'bus-01',
    driverId: 'staff-drv-1',
    latitude: 16.4680,
    longitude: 80.5280,
    speedKmH: 48,
    heading: 245,
    accuracyMeters: 6,
    timestamp: new Date().toISOString(),
    isLive: true,
  });

  // Initialize initial live GPS for internal circular loop
  store.locations.set('trip-104-loop', {
    id: 'loc-trip-104-1',
    tripId: 'trip-104-loop',
    busId: 'bus-03',
    driverId: 'staff-drv-2',
    latitude: 16.4952,
    longitude: 80.5010,
    speedKmH: 22,
    heading: 90,
    accuracyMeters: 4,
    timestamp: new Date().toISOString(),
    isLive: true,
  });

  global.__transitStore = store;
  return store;
}

export const store = getInitialStore();

// Initialize sample bookings & tickets asynchronously
async function ensureSeedTickets() {
  if (store.initialized) return;

  for (const b of SEED_BOOKINGS) {
    const trip = store.trips.get(b.tripId);
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
  return Array.from(store.routes.values());
}

export async function getRouteById(id: string): Promise<Route | undefined> {
  await ensureSeedTickets();
  return store.routes.get(id);
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
  return Array.from(store.trips.values()).map((t) => ({
    ...t,
    route: store.routes.get(t.routeId),
    bus: store.buses.get(t.busId),
    driver: store.staff.get(t.driverId),
    conductor: store.staff.get(t.conductorId),
  }));
}

export async function getTripById(id: string): Promise<Trip | undefined> {
  await ensureSeedTickets();
  const trip = store.trips.get(id);
  if (!trip) return undefined;
  return {
    ...trip,
    route: store.routes.get(trip.routeId),
    bus: store.buses.get(trip.busId),
    driver: store.staff.get(trip.driverId),
    conductor: store.staff.get(trip.conductorId),
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

export async function updateLiveLocation(data: {
  tripId: string;
  busId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speedKmH: number;
  heading: number;
  accuracyMeters: number;
}): Promise<GPSLocation> {
  const loc: GPSLocation = {
    id: `loc-${Date.now()}`,
    tripId: data.tripId,
    busId: data.busId,
    driverId: data.driverId,
    latitude: data.latitude,
    longitude: data.longitude,
    speedKmH: Math.round(data.speedKmH),
    heading: Math.round(data.heading),
    accuracyMeters: Math.round(data.accuracyMeters),
    timestamp: new Date().toISOString(),
    isLive: true,
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

