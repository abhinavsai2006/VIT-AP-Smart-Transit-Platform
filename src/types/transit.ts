export type UserRole =
  | 'student'
  | 'faculty'
  | 'visitor'
  | 'driver'
  | 'conductor'
  | 'transport_admin'
  | 'department_coordinator'
  | 'support_operator'
  | 'super_admin';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  regNumber?: string; // Student registration number (e.g., 21BCE1001)
  employeeId?: string; // Faculty / Employee ID (e.g., EMP501)
  phone?: string;
  department?: string;
  program?: string;
  preferredRouteId?: string;
  preferredStopId?: string;
  createdAt: string;
}

export interface BusPass {
  id: string;
  passNumber: string; // e.g. "VITAP/BP/2026/0842"
  userId: string;
  studentName: string;
  regNumber: string; // e.g. "21BCE1001"
  program: string;
  department: string;
  academicYear: string;
  semester: string;
  routeId: string;
  routeNumber: string; // e.g. "VV-01", "GV-05"
  routeName: string;
  pickupStopId: string;
  pickupStopName: string;
  pickupTime: string; // e.g. "07:25 AM"
  dropStopName: string; // "VIT-AP Central Campus"
  dropTime: string; // "08:45 AM"
  validFrom: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  status: 'active' | 'expired' | 'suspended' | 'pending_approval';
  photoUrl?: string;
  qrCodeDataUrl?: string;
  issuedAt: string;
  issuedBy: string;
  emergencyContact: string;
}


export interface Stop {
  id: string;
  code: string; // e.g., 'VIT-AP-MAIN', 'VJA-RLY-STN'
  name: string;
  description: string;
  landmark: string;
  // NaN when the location has not been resolved; never a guessed value
  latitude: number;
  longitude: number;
  // How the coordinate was obtained. Absent on legacy/admin-created stops (treated as manually entered).
  coordinateStatus?: 'surveyed' | 'reference' | 'geocoded_unverified' | 'unresolved';
  coordinateSource?: string;
  isAccessible: boolean;
  createdAt: string;
}

export interface RouteStop {
  // Official printed pickup time for this stop (e.g. "7.05 AM"), when imported from the timetable
  scheduledTime?: string;
  id: string;
  routeId: string;
  stopId: string;
  stopSequence: number;
  arrivalOffsetMinutes: number;
  departureOffsetMinutes: number;
  stop?: Stop;
}

export interface Route {
  id: string;
  routeNumber: string; // e.g., '101', '102X'
  routeName: string;
  description: string;
  originStopId: string;
  destinationStopId: string;
  status: 'active' | 'inactive' | 'suspended';
  estimatedDurationMinutes: number;
  distanceKm: number; // 0 when not measured
  fareAmount: number; // 0 for free campus shuttles
  stops: RouteStop[];
  region?: string; // e.g. 'Vijayawada', 'Guntur', 'Tenali'
  source?: string; // provenance, e.g. '2026-27 Bus Routes.pdf'
  geometry?: RouteGeometry;
}

// Planned road path for a route, computed offline by a routing engine (see data/README.md)
export interface RouteGeometry {
  // ok: road path through every stop; partial: some stops unlocated/rejected or legs suspect;
  // unavailable: no road path (nothing is drawn rather than a fabricated line)
  status: 'ok' | 'partial' | 'unavailable';
  coordinates: [number, number][]; // [lat, lng]
  distanceM?: number;
  provider?: string;
  profile?: string;
  excludedStops?: { seq: number; name: string; reason: string }[];
  problems?: string[];
  reason?: string;
}

export interface VehicleDocument {
  id: string;
  busId: string;
  documentType: 'insurance' | 'fitness' | 'pollution' | 'permit' | 'tax';
  documentNumber: string;
  expiryDate: string;
  status: 'valid' | 'expiring_soon' | 'expired';
  fileUrl?: string;
}

export interface Bus {
  id: string;
  busCode: string; // Internal fleet identifier e.g. "BUS-01"
  registrationNumber: string; // Normalized AP registration: "AP39TL1001"
  rawRegistration: string; // As entered: "AP 39 TL 1001"
  vehicleType: string; // "Air-Conditioned Express", "Standard Bus", "Mini Shuttle"
  model: string;
  manufacturer: string;
  seatingCapacity: number;
  standingCapacity: number;
  hasWheelchairAccess: boolean;
  fuelType: 'diesel' | 'cng' | 'electric' | 'hybrid';
  status: 'active' | 'maintenance' | 'out_of_service' | 'reserved';
  assignedDepot: string;
  currentOdometer: number;
  trackerImei?: string;
  documents: VehicleDocument[];
}

export interface StaffProfile {
  id: string;
  staffId: string; // e.g. "DRV-101", "CND-201"
  fullName: string;
  phone: string;
  email: string;
  role: 'driver' | 'conductor';
  licenseNumber?: string;
  licenseExpiry?: string;
  status: 'active' | 'on_leave' | 'inactive';
}

export interface TripStop {
  id: string;
  tripId: string;
  stopId: string;
  scheduledArrival: string;
  scheduledDeparture: string;
  actualArrival?: string;
  actualDeparture?: string;
  status: 'pending' | 'arrived' | 'departed' | 'skipped';
  stop?: Stop;
}

export interface Trip {
  id: string;
  routeId: string;
  busId: string;
  driverId: string;
  conductorId: string;
  travelDate: string; // YYYY-MM-DD
  departureTime: string; // HH:MM
  arrivalTime: string; // HH:MM
  status: 'draft' | 'scheduled' | 'boarding' | 'in_progress' | 'completed' | 'cancelled' | 'delayed';
  totalSeats: number;
  bookedSeats: number;
  operationalNotes?: string;
  route?: Route;
  bus?: Bus;
  driver?: StaffProfile;
  conductor?: StaffProfile;
  stops?: TripStop[];
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  token: string;
  bookingId: string;
  qrCodeDataUrl: string;
  status: 'valid' | 'used' | 'cancelled' | 'expired';
  validityStart: string;
  validityEnd: string;
  boardedAt?: string;
  validatedBy?: string;
}

export interface Booking {
  id: string;
  bookingReference: string;
  userId: string;
  tripId: string;
  passengerName: string;
  passengerEmail: string;
  passengerPhone: string;
  passengerType: 'student' | 'faculty' | 'visitor' | 'staff';
  originStopId: string;
  destinationStopId: string;
  seatCount: number;
  fareAmount: number;
  status: 'confirmed' | 'cancelled' | 'used' | 'payment_pending';
  bookedAt: string;
  trip?: Trip;
  ticket?: Ticket;
  originStop?: Stop;
  destinationStop?: Stop;
}

export interface BoardingScan {
  id: string;
  ticketId: string;
  tripId: string;
  scannedByStaffId: string;
  scannedAt: string;
  scanResult: 'valid' | 'already_used' | 'expired' | 'wrong_trip' | 'cancelled' | 'invalid';
  notes?: string;
  deviceFingerprint?: string;
  passengerName?: string;
  ticketNumber?: string;
}

export interface GPSLocation {
  id: string;
  tripId: string;
  busId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speedKmH: number;
  heading: number;
  accuracyMeters: number;
  timestamp: string;
  isLive: boolean; // False if stale (> 2 mins old)
  // latitude/longitude above are the raw device observation. When it matches the trip's planned
  // road path, the matched display position is given separately; it is never a new measurement.
  matchStatus?: 'on_route' | 'off_route' | 'low_accuracy' | 'ambiguous' | 'no_route';
  matchedLatitude?: number;
  matchedLongitude?: number;
  routeOffsetM?: number; // distance from the observation to the planned path
  alongRouteM?: number; // progress along the planned path, when matched
  source?: 'device';
}

export interface ServiceDisruption {
  id: string;
  routeId?: string;
  stopId?: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  startTime: string;
  endTime: string;
  status: 'active' | 'resolved';
  affectedRoutes: string[];
}

export interface MaintenanceRecord {
  id: string;
  busId: string;
  maintenanceType: 'preventive' | 'breakdown' | 'inspection' | 'oil_change' | 'tire_replacement';
  description: string;
  partsCost: number;
  labourCost: number;
  totalCost: number;
  vendorName: string;
  odometerAtService: number;
  serviceDate: string;
  completedDate?: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  reportedBy: string;
}

export interface FuelRecord {
  id: string;
  busId: string;
  fuelType: 'diesel' | 'cng' | 'electric';
  quantityLiters: number;
  costPerLiter: number;
  totalCost: number;
  odometerReading: number;
  fuelStation: string;
  date: string;
  recordedBy: string;
}

export interface Incident {
  id: string;
  tripId?: string;
  busId: string;
  driverId: string;
  category: 'breakdown' | 'accident' | 'delay' | 'medical' | 'conduct' | 'overcrowding';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  locationDescription: string;
  reportedAt: string;
  status: 'reported' | 'investigating' | 'resolved';
  actionTaken?: string;
}

export interface EventRequest {
  id: string;
  department: string;
  eventName: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coordinatorPhone: string;
  pickupLocation: string;
  dropLocation: string;
  startDate: string;
  endDate: string;
  passengerCount: number;
  requestedBuses: number;
  purpose: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'completed';
  approvedBusIds: string[];
  notes?: string;
  submittedAt: string;
}

export interface ComplaintMessage {
  id: string;
  complaintId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  message: string;
  sentAt: string;
  isInternal: boolean;
}

export interface Complaint {
  id: string;
  caseNumber: string;
  userId: string;
  passengerName: string;
  category: 'delay' | 'missed_pickup' | 'unsafe_driving' | 'conduct' | 'cleanliness' | 'lost_property' | 'other';
  tripId?: string;
  busId?: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'submitted' | 'under_review' | 'action_required' | 'resolved' | 'rejected';
  submittedAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  messages: ComplaintMessage[];
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'booking' | 'alert' | 'maintenance' | 'event';
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  performedBy: string;
  details: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
}

export interface SearchJourneyParams {
  originStopId: string;
  destinationStopId: string;
  travelDate: string;
  preferredTime?: string;
  passengers?: number;
}

export interface JourneySearchResult {
  route: Route;
  trip: Trip;
  originStop: Stop;
  destinationStop: Stop;
  originIndex: number;
  destinationIndex: number;
  departureTime: string;
  arrivalTime: string;
  estimatedDurationMinutes: number;
  availableSeats: number;
  totalSeats: number;
  fareAmount: number;
  isBookingAllowed: boolean;
  disruptions: ServiceDisruption[];
}
