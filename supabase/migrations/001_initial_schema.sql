-- VIT-AP SMART TRANSIT: Database Schema & Migration
-- Production PostgreSQL DDL for Supabase

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enumerations
CREATE TYPE user_role_enum AS ENUM (
  'student',
  'faculty',
  'visitor',
  'driver',
  'conductor',
  'transport_admin',
  'department_coordinator',
  'support_operator',
  'super_admin'
);

CREATE TYPE trip_status_enum AS ENUM (
  'draft',
  'scheduled',
  'boarding',
  'in_progress',
  'completed',
  'cancelled',
  'delayed',
  'interrupted'
);

CREATE TYPE ticket_status_enum AS ENUM (
  'valid',
  'used',
  'cancelled',
  'expired'
);

CREATE TYPE scan_result_enum AS ENUM (
  'valid',
  'already_used',
  'expired',
  'wrong_trip',
  'cancelled',
  'invalid'
);

CREATE TYPE vehicle_status_enum AS ENUM (
  'active',
  'maintenance',
  'out_of_service',
  'reserved'
);

CREATE TYPE complaint_status_enum AS ENUM (
  'submitted',
  'under_review',
  'action_required',
  'resolved',
  'rejected'
);

-- 3. Departments
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role_enum NOT NULL DEFAULT 'student',
  reg_number VARCHAR(50),
  employee_id VARCHAR(50),
  phone VARCHAR(50),
  department_id UUID REFERENCES departments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Stops
CREATE TABLE stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  landmark VARCHAR(255),
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  is_accessible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Routes
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_number VARCHAR(50) UNIQUE NOT NULL,
  route_name VARCHAR(255) NOT NULL,
  description TEXT,
  origin_stop_id UUID REFERENCES stops(id),
  destination_stop_id UUID REFERENCES stops(id),
  status VARCHAR(50) DEFAULT 'active',
  estimated_duration_minutes INT NOT NULL,
  distance_km NUMERIC(6, 2) NOT NULL,
  fare_amount NUMERIC(8, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Route Stops
CREATE TABLE route_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  stop_id UUID REFERENCES stops(id) ON DELETE CASCADE,
  stop_sequence INT NOT NULL,
  arrival_offset_minutes INT DEFAULT 0,
  departure_offset_minutes INT DEFAULT 0,
  UNIQUE (route_id, stop_sequence),
  UNIQUE (route_id, stop_id)
);

-- 8. Buses (Fleet)
CREATE TABLE buses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_code VARCHAR(50) UNIQUE NOT NULL,
  registration_number VARCHAR(20) UNIQUE NOT NULL, -- Normalized AP registration e.g. AP39TL1001
  raw_registration VARCHAR(50) NOT NULL,
  vehicle_type VARCHAR(100) NOT NULL,
  model VARCHAR(100),
  manufacturer VARCHAR(100),
  seating_capacity INT NOT NULL CHECK (seating_capacity > 0),
  standing_capacity INT DEFAULT 0,
  has_wheelchair_access BOOLEAN DEFAULT FALSE,
  fuel_type VARCHAR(50) DEFAULT 'diesel',
  status vehicle_status_enum DEFAULT 'active',
  assigned_depot VARCHAR(100),
  current_odometer INT DEFAULT 0,
  tracker_imei VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Vehicle Documents
CREATE TABLE vehicle_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id UUID REFERENCES buses(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  document_number VARCHAR(100) NOT NULL,
  expiry_date DATE NOT NULL,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Staff (Drivers & Conductors)
CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  staff_id VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('driver', 'conductor')),
  license_number VARCHAR(100),
  license_expiry DATE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Trips
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID REFERENCES routes(id) ON DELETE RESTRICT,
  bus_id UUID REFERENCES buses(id) ON DELETE RESTRICT,
  driver_id UUID REFERENCES staff_profiles(id) ON DELETE RESTRICT,
  conductor_id UUID REFERENCES staff_profiles(id) ON DELETE RESTRICT,
  travel_date DATE NOT NULL,
  departure_time TIME NOT NULL,
  arrival_time TIME NOT NULL,
  status trip_status_enum DEFAULT 'scheduled',
  total_seats INT NOT NULL,
  booked_seats INT DEFAULT 0 CHECK (booked_seats <= total_seats),
  operational_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_reference VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  trip_id UUID REFERENCES trips(id) ON DELETE RESTRICT,
  passenger_name VARCHAR(255) NOT NULL,
  passenger_email VARCHAR(255) NOT NULL,
  passenger_phone VARCHAR(50) NOT NULL,
  passenger_type VARCHAR(50) NOT NULL,
  origin_stop_id UUID REFERENCES stops(id),
  destination_stop_id UUID REFERENCES stops(id),
  seat_count INT NOT NULL DEFAULT 1 CHECK (seat_count > 0),
  fare_amount NUMERIC(8, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'confirmed',
  booked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Tickets
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  token TEXT UNIQUE NOT NULL, -- Cryptographic signed token
  booking_id UUID UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  qr_code_data_url TEXT NOT NULL,
  status ticket_status_enum DEFAULT 'valid',
  validity_start TIMESTAMPTZ NOT NULL,
  validity_end TIMESTAMPTZ NOT NULL,
  boarded_at TIMESTAMPTZ,
  validated_by UUID REFERENCES staff_profiles(id)
);

-- 14. Boarding Scans (Audit Trail & Duplicate Protection)
CREATE TABLE boarding_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id),
  trip_id UUID REFERENCES trips(id),
  scanned_by_staff_id UUID REFERENCES staff_profiles(id),
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  scan_result scan_result_enum NOT NULL,
  notes TEXT,
  device_fingerprint VARCHAR(255)
);

-- 15. GPS Locations
CREATE TABLE gps_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  bus_id UUID REFERENCES buses(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES staff_profiles(id),
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  speed_km_h INT DEFAULT 0,
  heading INT DEFAULT 0,
  accuracy_meters NUMERIC(6, 2),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Service Disruptions
CREATE TABLE service_disruptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
  stop_id UUID REFERENCES stops(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(50) DEFAULT 'info',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Maintenance & Fuel
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id UUID REFERENCES buses(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  parts_cost NUMERIC(10, 2) DEFAULT 0,
  labour_cost NUMERIC(10, 2) DEFAULT 0,
  total_cost NUMERIC(10, 2) DEFAULT 0,
  vendor_name VARCHAR(255),
  odometer_at_service INT,
  service_date DATE NOT NULL,
  completed_date DATE,
  status VARCHAR(50) DEFAULT 'scheduled',
  reported_by VARCHAR(255)
);

CREATE TABLE fuel_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id UUID REFERENCES buses(id) ON DELETE CASCADE,
  fuel_type VARCHAR(50) NOT NULL,
  quantity_liters NUMERIC(8, 2) NOT NULL,
  cost_per_liter NUMERIC(8, 2) NOT NULL,
  total_cost NUMERIC(10, 2) NOT NULL,
  odometer_reading INT NOT NULL,
  fuel_station VARCHAR(255),
  date DATE NOT NULL,
  recorded_by VARCHAR(255)
);

-- 18. Incidents
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  bus_id UUID REFERENCES buses(id) ON DELETE RESTRICT,
  driver_id UUID REFERENCES staff_profiles(id) ON DELETE RESTRICT,
  category VARCHAR(100) NOT NULL,
  severity VARCHAR(50) DEFAULT 'medium',
  description TEXT NOT NULL,
  location_description TEXT,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'reported',
  action_taken TEXT
);

-- 19. Event Transport Requests
CREATE TABLE event_transport_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  coordinator_name VARCHAR(255) NOT NULL,
  coordinator_email VARCHAR(255) NOT NULL,
  coordinator_phone VARCHAR(50) NOT NULL,
  pickup_location VARCHAR(255) NOT NULL,
  drop_location VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  passenger_count INT NOT NULL,
  requested_buses INT NOT NULL,
  purpose TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. Complaints & Messages
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  passenger_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  bus_id UUID REFERENCES buses(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  priority VARCHAR(50) DEFAULT 'medium',
  status complaint_status_enum DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

CREATE TABLE complaint_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  sender_name VARCHAR(255) NOT NULL,
  sender_role user_role_enum NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  is_internal BOOLEAN DEFAULT FALSE
);

-- 21. Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  link TEXT
);

-- 22. Indexes for High-Traffic Queries
CREATE INDEX idx_trips_date_route ON trips(travel_date, route_id, status);
CREATE INDEX idx_bookings_user ON bookings(user_id, status);
CREATE INDEX idx_tickets_token ON tickets(token);
CREATE INDEX idx_buses_reg ON buses(registration_number);
CREATE INDEX idx_gps_trip ON gps_locations(trip_id, timestamp DESC);
CREATE INDEX idx_complaints_user ON complaints(user_id);

-- 23. Row Level Security Policies (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Passengers can view and manage only their own profiles
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Passengers can view their own bookings
CREATE POLICY "Users can read own bookings" ON bookings
  FOR SELECT USING (auth.uid() = user_id);

-- Drivers and conductors can view tickets for their assigned trips
CREATE POLICY "Staff can view trip tickets" ON tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips
      JOIN staff_profiles ON (trips.driver_id = staff_profiles.id OR trips.conductor_id = staff_profiles.id)
      WHERE staff_profiles.user_id = auth.uid()
      AND trips.id = (SELECT trip_id FROM bookings WHERE bookings.id = tickets.booking_id)
    )
  );

-- Transport Admins have full access
CREATE POLICY "Transport admins have full access on bookings" ON bookings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('transport_admin', 'super_admin')
    )
  );

-- 24. Student & Faculty Bus Passes
CREATE TABLE bus_passes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pass_number VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  student_name VARCHAR(150) NOT NULL,
  reg_number VARCHAR(50) NOT NULL,
  program VARCHAR(150),
  department VARCHAR(150),
  academic_year VARCHAR(50) NOT NULL,
  semester VARCHAR(50) NOT NULL,
  route_id UUID REFERENCES routes(id),
  route_number VARCHAR(20) NOT NULL,
  route_name VARCHAR(150) NOT NULL,
  pickup_stop_id UUID REFERENCES stops(id),
  pickup_stop_name VARCHAR(150) NOT NULL,
  pickup_time VARCHAR(20) NOT NULL,
  drop_stop_name VARCHAR(150) DEFAULT 'VIT-AP Central Campus',
  drop_time VARCHAR(20) DEFAULT '08:45 AM',
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'active',
  photo_url TEXT,
  qr_code_data_url TEXT,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  issued_by VARCHAR(150),
  emergency_contact VARCHAR(50)
);

CREATE INDEX idx_bus_passes_user ON bus_passes(user_id, status);
CREATE INDEX idx_bus_passes_reg ON bus_passes(reg_number);

ALTER TABLE bus_passes ENABLE ROW LEVEL SECURITY;

-- Passengers can view their own bus passes
CREATE POLICY "Users can read own bus passes" ON bus_passes
  FOR SELECT USING (auth.uid() = user_id);

-- Transport Admins have full access on bus passes
CREATE POLICY "Admins have full access on bus passes" ON bus_passes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('transport_admin', 'super_admin')
    )
  );

-- 25. Enable Supabase Realtime for Telemetry & Pass Synchronization
-- Run these on Supabase instances where realtime publication is active
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE gps_locations;
    ALTER PUBLICATION supabase_realtime ADD TABLE trips;
    ALTER PUBLICATION supabase_realtime ADD TABLE bus_passes;
  END IF;
END $$;

