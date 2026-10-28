# VIT-AP Smart Transit Platform
## Complete University Bus Management, Live Telemetry Tracking, Cryptographic QR Ticketing & Fleet Operations System

**VIT-AP Smart Transit** is an enterprise-grade university transit, fleet governance, and passenger ticketing platform built specifically for **VIT-AP University, Amaravati, Andhra Pradesh, India**.

The system addresses the end-to-end university transportation lifecycle: from directional corridor route planning, atomic seat reservations, and HMAC-SHA256 signed QR boarding passes to live GPS driver telemetry, conductor mobile scanning, Andhra Pradesh vehicle compliance (`AP39...`), preventive fleet maintenance, department event charters, and administrative audit governance.

---

## 1. System Architecture & Core Innovations

The platform is designed around strict automotive precision principles (inspired by BMW design guidelines: `#1c69d4` BMW Blue, `#1a2129` Dark Surface, sharp rectangular geometry, high-contrast typography, zero gratuitous drop-shadows) and industrial software patterns:

1. **Directional Journey Planning Engine (`src/lib/journey-planner.ts`):**
   - Strictly enforces directional stop ordering. Forward journeys (e.g. *Vijayawada Junction -> VIT-AP Central Campus*) succeed, whereas reverse searches against the same route pattern are rejected with transparent explanations.
   - Calculates intermediate stop arrival times based on cumulative scheduled offsets.
   - Evaluates active corridor disruptions in real time and attaches service advisories.

2. **Andhra Pradesh Vehicle Registration Validator (`src/lib/ap-registration.ts`):**
   - Normalizes raw inputs with arbitrary whitespace, hyphens, and casing (`ap-39-tl-1001`, `AP 39 TL 1001`) into canonical unique keys (`AP39TL1001`).
   - Validates Indian MoRTH standards and authentic Andhra Pradesh RTO district codes (`AP02` Anantapur through `AP39` Tirupati / Amaravati and `AP40`), supporting administrative override flags for special institutional vehicles.
   - Enforces fleet-wide registration uniqueness to prevent duplicate vehicle onboarding.

3. **Cryptographic QR Ticketing & Atomic Duplicate-Scan Protection (`src/lib/qr-crypto.ts` & `src/lib/db/store.ts`):**
   - Tickets contain an opaque, HMAC-SHA256 signed token embedding `{ ticketId, bookingId, tripId, issuedAt }`.
   - Prevents client-side forgery: modifying any ticket parameter invalidates the cryptographic signature.
   - **Atomic Consumption:** Conductor validation marks the ticket as `used` in a single server-side step. Any subsequent attempt to scan the same QR code returns `already_used` with the exact previous scan timestamp and validator staff ID.

4. **Live GPS Telemetry & Stale Detection Engine (`src/app/driver/page.tsx` & `src/app/tracking/page.tsx`):**
   - Transmits real driver device geolocation coordinates via HTML5 `navigator.geolocation` or an external hardware GPS webhook (`POST /api/trips/[id]/location`).
   - Server continuously computes telemetry freshness: if GPS data is older than 120 seconds, the bus is explicitly badged as **"Location Unavailable / Stale Signal"** rather than fabricating moving coordinates.

5. **Dual-Mode Persistence Architecture:**
   - **Production Mode:** Fully normalized Supabase PostgreSQL database schema (`supabase/migrations/001_initial_schema.sql`) with foreign keys, compound indexes, and Row Level Security (RLS) policies enforcing multi-role tenant isolation.
   - **Zero-Config Development Mode:** High-performance, in-memory repository store (`src/lib/db/store.ts`) seeded with realistic demonstration data for VIT-AP corridors (Amaravati, Vijayawada, Guntur, Tenali). Hot-reload resilient and instantly operational without cloud credentials.

---

## 2. Role-Based Access Control (RBAC)

The system enforces 9 distinct university user roles across unified interfaces:

| Role | Permissions & Portals | Access URL |
| :--- | :--- | :--- |
| **Student / Passenger** | Search journeys, reserve seats, access digital QR ticket wallet, track assigned buses, file complaints | `/`, `/booking`, `/tickets`, `/dashboard` |
| **Faculty / Employee** | Priority eligible bookings, department commute access, grievance tracking | `/dashboard`, `/tickets` |
| **Visitor / Event Attendee** | Access approved event shuttles and guest boarding passes | `/events`, `/tickets` |
| **Bus Driver** | Cockpit interface, start/end assigned trips, broadcast real-time GPS location, report road breakdowns | `/driver` |
| **Conductor / Validator** | Mobile camera QR scanner, trip boarding manifest, manual fallback token verification, scan logs | `/conductor` |
| **Transport Administrator** | Fleet registry, AP vehicle compliance, scheduling, dispatch, corridor routes, disruptions, KPI analytics | `/admin`, `/admin/fleet`, `/admin/trips` |
| **Department Coordinator** | Submit charter transport requisitions (conferences, fest shuttles), monitor approvals | `/coordinator` |
| **Support Operator** | Review passenger complaints, escalate urgent safety flags, communicate authoritative resolutions | `/admin/complaints` |
| **Super Admin / Auditor** | System parameters, integration health, CSV data exports, immutable security audit trail | `/admin/settings` |

> **Development Role Switcher:** In development, an active role dropdown in the navigation header allows instant switching between pre-configured seed users (`student`, `driver`, `conductor`, `transport_admin`, `department_coordinator`, `support_operator`).

---

## 3. Application Directory & Module Map

```
E:\bus\
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── complaints/page.tsx    # Administrative grievance resolution workspace
│   │   │   ├── disruptions/page.tsx   # Service disruption & alert broadcast console
│   │   │   ├── fleet/page.tsx         # Fleet registry & Andhra Pradesh vehicle compliance
│   │   │   ├── maintenance/page.tsx   # Work orders, fuel expenditure & odometer logs
│   │   │   ├── routes/page.tsx        # Corridor route creation & stop sequence manager
│   │   │   ├── settings/page.tsx      # System parameters, CSV data exports & audit trail
│   │   │   ├── trips/page.tsx         # Trip scheduling, vehicle/driver dispatch console
│   │   │   └── page.tsx               # Transport executive KPI metrics dashboard
│   │   ├── api/
│   │   │   ├── admin/audit-logs/      # Administrative audit log retrieval & recording
│   │   │   ├── admin/export/          # CSV downloads (fleet, trips, scans, complaints)
│   │   │   ├── bookings/              # Atomic seat reservation & cancellation
│   │   │   ├── complaints/            # Grievance submission & message threading
│   │   │   ├── disruptions/           # Service advisory management
│   │   │   ├── events/                # Department charter transport requisitions
│   │   │   ├── fleet/                 # Bus registry & document management
│   │   │   ├── fuel/                  # Vehicle refueling records
│   │   │   ├── journey/search/        # Directional route search engine
│   │   │   ├── maintenance/           # Preventive maintenance & repair orders
│   │   │   ├── routes/                # Route & stop sequence governance
│   │   │   ├── stops/                 # Campus & city bus stop directory
│   │   │   ├── tickets/validate-qr/   # Atomic QR ticket verification & scan consumption
│   │   │   └── trips/                 # Dispatching & GPS telemetry ingestion
│   │   ├── booking/page.tsx           # Passenger seat reservation workflow
│   │   ├── complaints/page.tsx        # Passenger grievance submission & timeline
│   │   ├── conductor/page.tsx         # Conductor mobile QR camera scanner & manifest
│   │   ├── coordinator/page.tsx       # Department event transport requisition portal
│   │   ├── dashboard/page.tsx         # Personalized passenger travel dashboard
│   │   ├── driver/page.tsx            # Driver cockpit & GPS telemetry broadcast
│   │   ├── events/page.tsx            # Special events & railway express shuttles
│   │   ├── routes/page.tsx            # Public route directory & stop sequences
│   │   ├── stops/page.tsx             # Public bus stop directory & landmarks
│   │   ├── tickets/page.tsx           # Digital ticket wallet & high-resolution QR view
│   │   ├── tracking/page.tsx          # Live fleet GPS radar & corridor map
│   │   ├── globals.css                # Design system tokens matching design.md
│   │   ├── layout.tsx                 # Root layout with responsive navbar & footer
│   │   └── page.tsx                   # Public home & journey search portal
│   ├── components/
│   │   ├── layout/Footer.tsx          # Institutional footer with safety hotline
│   │   ├── map/TransitMap.tsx         # Interactive Leaflet map with custom SVG markers
│   │   ├── navbar/Navbar.tsx          # Responsive navigation with role switcher
│   │   └── qr/QrScannerModal.tsx      # Real camera QR scanner using jsqr
│   ├── lib/
│   │   ├── ap-registration.ts         # Andhra Pradesh vehicle registration validator
│   │   ├── journey-planner.ts         # Directional sequence search & offset calculator
│   │   ├── qr-crypto.ts               # HMAC-SHA256 token generator & verifier
│   │   ├── seed-data.ts               # Authoritative VIT-AP demonstration seed data
│   │   ├── auth/auth-context.tsx      # Client auth state & role switching provider
│   │   ├── db/store.ts                # Authoritative state store & atomic operators
│   │   └── supabase/                  # Supabase client & server connection helpers
│   └── types/
│       └── transit.ts                 # Full domain TypeScript models & schemas
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql     # PostgreSQL DDL, foreign keys, RLS & indexes
├── tests/
│   └── transit.test.ts                # 23 unit & integration test cases (Vitest)
├── .env.example                       # Documented environment configuration template
└── README.md                          # Comprehensive system documentation
```

---

## 4. Quick Start & Local Development

### Prerequisites
- **Node.js**: v20+ or v22+
- **Package Manager**: `npm` (v10+)
- Modern web browser with camera and geolocation permissions (for testing live driver telemetry and conductor scanning).

### Installation Steps

1. **Clone and Install Dependencies:**
   ```bash
   cd e:/bus
   npm install
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   *Note: Default cryptographic salts and demonstration settings are pre-configured in `.env.example` so the platform boots immediately without requiring external keys.*

3. **Run Automated Test Suite:**
   ```bash
   npm test
   ```
   *Expected outcome: 23 passing tests covering AP vehicle registration, directional stop sequence validation, HMAC QR signing, atomic duplicate scan protection, seat capacity concurrency, maintenance availability locks, and telemetry freshness.*

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Verify Production Build:**
   ```bash
   npm run build
   ```
   Compiles and prerenders all 36 static pages and dynamic route handlers using Next.js Turbopack.

---

## 5. End-to-End Operational Demonstration Script

To experience the complete transportation lifecycle as envisioned in the system requirements:

### Step 1: Admin Registers an AP Vehicle & Dispatches a Trip
1. In the header navigation bar, select **Transport Admin** from the role dropdown.
2. Navigate to **Fleet Management** (`/admin/fleet`).
3. Click **"+ Register New Vehicle"**:
   - Fleet Code: `BUS-99`
   - Official AP Registration: `AP 39 ZZ 9999` (notice instant validation: recognized as *AP39 - Tirupati / Amaravati District*).
   - Capacity: `40 Seats`, Fuel: `Electric`.
   - Submit. Notice the duplicate protection and document expiry reminders.
4. Navigate to **Trip Scheduling** (`/admin/trips`).
5. Click **"+ Schedule New Trip"**:
   - Select Route: `Route 101 — Vijayawada Jn to Amaravati Campus`.
   - Vehicle: `BUS-99 (AP39ZZ9999)`.
   - Driver: `K. Rama Rao (DRV-101)`.
   - Departure: `08:00`, Arrival: `08:50`.
   - Submit. Trip status is set to `Scheduled`.

### Step 2: Passenger Searches & Books a Seat
1. Switch active role to **Student (Passenger)**.
2. Go to the Home Page (`/`).
3. Under Journey Search:
   - Origin: `Vijayawada Railway Station (VJA-RLY-STN)`.
   - Destination: `VIT-AP Central Campus (VIT-AP-MAIN)`.
   - Date: `Today`.
   - Click **"Search Available Services"**.
4. The system validates the directional stop sequence and displays available trips with remaining seat counts.
5. Click **"Reserve Seat"**, enter passenger details, and confirm.
6. A booking reference and signed digital ticket (`TKT-VITAP-...`) are generated atomically.

### Step 3: Passenger Views High-Resolution QR Boarding Pass
1. Navigate to **Ticket Wallet** (`/tickets`).
2. Click on the issued ticket to open the high-resolution QR modal.
3. Observe the HMAC-SHA256 cryptographic signature, trip date, boarding stop, and manual fallback reference number.

### Step 4: Driver Starts Trip & Broadcasts Live GPS
1. Switch active role to **Bus Driver**.
2. Navigate to **Driver Cockpit** (`/driver`).
3. The assigned trip is highlighted. Click **"Begin Trip"**. Trip status transitions to `in_progress`.
4. Click **"Enable GPS Broadcasting"**. The application requests browser geolocation and transmits live coordinates (`lat`, `lng`, `speed`, `heading`) to `/api/trips/[id]/location`.
5. Open **Live Tracking** (`/tracking`) in another tab to observe the bus marker moving on the interactive map with speed telemetry and an active green **"LIVE GPS"** pulse badge.

### Step 5: Conductor Scans & Validates the Ticket
1. Switch active role to **Conductor**.
2. Navigate to **Ticket Validator** (`/conductor`).
3. Click **"Open QR Scanner"** (uses camera feed with `jsqr`) or paste the ticket's manual token.
4. Click **"Verify & Board Passenger"**.
5. The server validates the cryptographic signature, trip ID, and consumption state:
   - **First Scan:** Displays a green **"VALID TICKET — BOARDING PERMITTED"** visual confirmation with passenger name.
6. Attempt to scan the exact same QR code a second time:
   - **Second Scan:** Server atomically blocks boarding and triggers a red **"ALREADY USED"** alert displaying the previous scan timestamp and conductor ID.

### Step 6: Administrator Inspects Audit Logs & Exports CSV
1. Switch active role to **Transport Admin** or **Super Admin**.
2. Navigate to **System Settings & Audit** (`/admin/settings`).
3. Under **Operational Data & Report Exports**, click **"Export CSV"** for **Fleet Master**, **Trips**, or **Boarding Scans**.
4. Scroll to **Authoritative Audit Trail** to inspect the timestamped, immutable record of vehicle additions, trip dispatching, and boarding scan events.

---

## 6. Integration Status Hub

| Integration Component | Current Operational Status | Fallback / Configuration Behavior |
| :--- | :--- | :--- |
| **Supabase PostgreSQL** | **Production Ready** | Full DDL migration provided in `supabase/migrations/001_initial_schema.sql`. In local development without credentials, seamlessly uses the high-performance in-memory repository store (`src/lib/db/store.ts`). |
| **Supabase Authentication** | **Production Ready** | Built-in Auth client with cookie-based SSR. Multi-role demo switcher provides zero-friction local testing across all 9 user personas. |
| **HMAC-SHA256 QR Signer** | **Active & Live** | Cryptographically signs and validates ticket payloads using `QR_SECRET_SALT`. Independent of external vendors. |
| **Driver GPS Telemetry** | **Active & Live** | Driver device HTML5 Geolocation API with automatic 120s stale detection. Hardware GPS trackers can push to `POST /api/trips/[id]/location`. |
| **Interactive Mapping** | **Active & Live** | Leaflet OSM with custom SVG institutional bus and stop markers, corridor polylines, and accessible table fallback. |
| **Payment Gateway** | **Configurable Adapter** | Campus transportation is free for enrolled students. Payment adapter for paid charters or semester passes is structured; gateway remains disabled until institutional merchant keys (`PAYMENT_GATEWAY_KEY`) are supplied. |
| **SMS / WhatsApp Gateway** | **Configurable Adapter** | In-app notification hub is primary. External SMS gateway adapter is ready for institutional credentials (`SMS_GATEWAY_AUTH_TOKEN`). |

---

## 7. Database Initialization & Supabase Setup

When deploying to a dedicated Supabase PostgreSQL instance:

1. Create a new project in the [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor** in your Supabase project.
3. Paste and run the entire contents of `supabase/migrations/001_initial_schema.sql`.
   - Creates tables: `profiles`, `stops`, `routes`, `route_stops`, `buses`, `vehicle_documents`, `staff_profiles`, `trips`, `trip_stops`, `bookings`, `tickets`, `boarding_scans`, `gps_locations`, `service_disruptions`, `maintenance_records`, `fuel_records`, `incidents`, `event_transport_requests`, `complaints`, `complaint_messages`, `notifications`, `audit_logs`.
   - Applies compound indexes for search performance (`route_stops`, `gps_locations`, `trips`).
   - Enables Row Level Security (RLS) policies ensuring students access only their bookings, drivers access only assigned trips, and administrators hold management authority.
4. Copy your project URL, anon key, and service role key to `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

---

## 8. Test Verification & Quality Assurance

The test suite in `tests/transit.test.ts` executes 23 automated unit and integration tests using Vitest:

1. **AP Vehicle Registration Normalization:** Normalizes raw registrations with arbitrary whitespace and hyphens into canonical format (`AP39TL1001`).
2. **RTO District Code Validation:** Validates authentic Andhra Pradesh RTO codes (`AP39`, `AP16`, `AP07`) and rejects malformed inputs.
3. **Fleet Registration Uniqueness:** Prevents registering duplicate license plates.
4. **Directional Journey Search:** Verifies forward route searches succeed while reverse direction searches are rejected.
5. **Intermediate Stop Sequence Offsets:** Confirms departure and arrival times account for route stop offsets.
6. **HMAC-SHA256 Tokenization:** Validates authentic tokens and rejects tampered tokens.
7. **Atomic Seat Capacity Management:** Decrements available seats atomically and rejects overbooking.
8. **Trip State Locks:** Rejects bookings on trips that are completed or cancelled.
9. **Atomic QR Boarding Verification:** Permits first scan and marks ticket as used.
10. **Duplicate-Scan Rejection:** Blocks subsequent boarding scans and returns previous scan metadata.
11. **Wrong-Trip Protection:** Rejects tickets presented on an incorrect service.
12. **Cancelled Ticket Protection:** Rejects cancelled tickets at the boarding gate.
13. **Vehicle Maintenance Availability Rules:** Prohibits assigning vehicles currently in maintenance.
14. **Driver Duty Conflict Checks:** Prohibits double-booking drivers or buses for overlapping departure slots.
15. **Telemetry Freshness & Stale Detection:** Flags GPS data older than 120 seconds as stale / location unavailable.
16. **Department Requisition Lifecycle:** Follows `pending -> approved` workflow with vehicle allocation.
17. **Service Disruption Broadcast:** Propagates corridor warnings to affected route schedules.
18. **Tenant Isolation:** Ensures passengers only view their private booking and grievance records.
19. **Immutable Security Audit Trail:** Records administrative mutations with timestamps and actor IDs.
20. **Boarding Scan Audit Reporting:** Aggregates operational scan records across fleet conductors.

To run the tests:
```bash
npm test
```

---

## 9. Known Limitations & Roadmap

- **Offline QR Manifest Sync:** Conductor scanning currently validates against the live server endpoint. An offline encrypted SQLite manifest mode for connectivity blackspots in rural corridor stretches is planned for Phase 2.
- **Automated Payment Gateway:** External payment processing is disabled by default; transactions for guest/event shuttles currently operate in zero-cost demonstration mode until university merchant credentials (SBI ePay / Razorpay) are approved.
- **Automated Telematics Hardware:** Location telemetry currently accepts inputs from driver mobile browsers and HTTP webhooks. Dedicated OBD-II / AIS-140 GPS hardware protocols can be piped directly into the existing `/api/trips/[id]/location` endpoint.

---

## 10. Compliance & Institutional Identity

- **Institution:** VIT-AP University, Beside AP Secretariat, Inavolu, Amaravati, Andhra Pradesh 522237, India.
- **Operational Timezone:** Indian Standard Time (`Asia/Kolkata`, UTC+05:30).
- **Emergency Transport Helpline:** `+91 863 2370 444` | `transit-safety@vitap.ac.in`.
- **Vehicle Standard:** MoRTH India / Andhra Pradesh Motor Vehicles Rules.
