'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bus, Trip, Complaint, EventRequest, MaintenanceRecord, ServiceDisruption } from '@/types/transit';
import {
  Shield,
  Bus as BusIcon,
  Calendar,
  AlertTriangle,
  Wrench,
  Users,
  Compass,
  Radio,
  FileText,
  DollarSign,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Settings as SettingsIcon,
  MapPin,
} from 'lucide-react';

export default function AdminOverviewPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [disruptions, setDisruptions] = useState<ServiceDisruption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminData() {
      try {
        setLoading(true);
        const [fleetRes, tripsRes, compRes, evRes, maintRes, disruptRes] = await Promise.all([
          fetch('/api/fleet'),
          fetch('/api/trips'),
          fetch('/api/complaints'),
          fetch('/api/events'),
          fetch('/api/maintenance'),
          fetch('/api/disruptions'),
        ]);

        const fleetData = await fleetRes.json();
        const tripsData = await tripsRes.json();
        const compData = await compRes.json();
        const evData = await evRes.json();
        const maintData = await maintRes.json();
        const disruptData = await disruptRes.json();

        setBuses(fleetData.buses || []);
        setTrips(tripsData.trips || []);
        setComplaints(compData.complaints || []);
        setEventRequests(evData.eventRequests || []);
        setMaintenance(maintData.records || []);
        setDisruptions(disruptData.disruptions || []);
      } catch (err) {
        console.error('Failed to load admin overview metrics', err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, []);

  const activeBuses = buses.filter((b) => b.status === 'active');
  const maintenanceBuses = buses.filter((b) => b.status === 'maintenance');
  const activeTrips = trips.filter((t) => t.status === 'in_progress');
  const scheduledTrips = trips.filter((t) => t.status === 'scheduled');
  const openComplaints = complaints.filter((c) => c.status !== 'resolved' && c.status !== 'rejected');
  const pendingEvents = eventRequests.filter((e) => e.status === 'pending');

  // Calculate total booked seats and total capacity
  const totalCapacity = trips.reduce((sum, t) => sum + (t.totalSeats || 0), 0);
  const totalBooked = trips.reduce((sum, t) => sum + (t.bookedSeats || 0), 0);
  const utilizationPercent = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;

  return (
    <div style={{ padding: '48px 0', minHeight: '80vh' }}>
      <div className="container">
        {/* Admin Header */}
        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-surface-dark)',
            color: '#ffffff',
            padding: '32px',
            marginBottom: '32px',
            border: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Shield size={28} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#93c5fd', fontWeight: 700 }}>
                  Transport Administration Command Center
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, marginTop: '2px' }}>
                  VIT-AP Fleet Operations & Governance
                </h1>
                <div style={{ fontSize: '12px', color: 'var(--color-on-dark-soft)', marginTop: '2px' }}>
                  Unified telemetry, Andhra Pradesh vehicle compliance, scheduling, and passenger logistics.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Link href="/admin/fleet" className="btn btn-primary btn-sm">
                + Register Bus (AP Reg)
              </Link>
              <Link href="/admin/trips" className="btn btn-outline-dark btn-sm">
                + Dispatch Trip
              </Link>
            </div>
          </div>
        </div>

        {/* 6 Executive KPI Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '20px',
            marginBottom: '36px',
          }}
        >
          <div className="card" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Fleet Availability
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-ink)', margin: '6px 0' }}>
              {activeBuses.length} / {buses.length}
            </div>
            <div style={{ fontSize: '12px', color: maintenanceBuses.length > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {maintenanceBuses.length} in workshop
            </div>
          </div>

          <div className="card" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Trips Scheduled Today
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-primary)', margin: '6px 0' }}>
              {trips.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-body)' }}>
              {activeTrips.length} live on route now
            </div>
          </div>

          <div className="card" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Seat Utilization
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-ink)', margin: '6px 0' }}>
              {utilizationPercent}%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              {totalBooked} of {totalCapacity} seats
            </div>
          </div>

          <div className="card" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Open Complaints
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: openComplaints.length > 0 ? 'var(--color-error)' : 'var(--color-success)', margin: '6px 0' }}>
              {openComplaints.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              Helpdesk cases pending
            </div>
          </div>

          <div className="card" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Event Approvals
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-accent-amber)', margin: '6px 0' }}>
              {pendingEvents.length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              Department requisitions
            </div>
          </div>

          <div className="card" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Service Alerts Active
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-ink)', margin: '6px 0' }}>
              {disruptions.filter((d) => d.status === 'active').length}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              Corridor advisories
            </div>
          </div>
        </div>

        {/* Operational Modules Navigation Grid */}
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
          Transportation Administration Modules
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
            marginBottom: '40px',
          }}
        >
          {/* Fleet Module */}
          <Link href="/admin/fleet" className="card" style={{ padding: '24px', backgroundColor: '#ffffff', color: 'var(--color-ink)', transition: 'transform 0.1s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <BusIcon size={24} color="var(--color-primary)" />
              <span className="badge badge-neutral">{buses.length} Vehicles</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Fleet Registry & AP Registration</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-body)', margin: 0 }}>
              MoRTH & Andhra Pradesh vehicle code normalization, duplicate protection, and document expiry logs.
            </p>
          </Link>

          {/* Trips Module */}
          <Link href="/admin/trips" className="card" style={{ padding: '24px', backgroundColor: '#ffffff', color: 'var(--color-ink)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <Compass size={24} color="var(--color-primary)" />
              <span className="badge badge-neutral">{trips.length} Scheduled</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Trip Scheduling & Dispatch</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-body)', margin: 0 }}>
              Assign vehicles, drivers, and conductors. Prevent overlapping duties and out-of-service bus allocations.
            </p>
          </Link>

          {/* Routes & Stops */}
          <Link href="/admin/routes" className="card" style={{ padding: '24px', backgroundColor: '#ffffff', color: 'var(--color-ink)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <Calendar size={24} color="var(--color-primary)" />
              <span className="badge badge-neutral">Corridor Rules</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Route & Stop Governance</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-body)', margin: 0 }}>
              Define stop sequences, directional offsets, accessibility criteria, and fare structures.
            </p>
          </Link>

          {/* Maintenance & Fuel */}
          <Link href="/admin/maintenance" className="card" style={{ padding: '24px', backgroundColor: '#ffffff', color: 'var(--color-ink)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <Wrench size={24} color="var(--color-primary)" />
              <span className="badge badge-neutral">{maintenance.length} Work Orders</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Maintenance & Fuel Logs</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-body)', margin: 0 }}>
              Preventive maintenance work orders, breakdown repairs, fuel purchases, and odometer expenditure.
            </p>
          </Link>

          {/* Complaints */}
          <Link href="/admin/complaints" className="card" style={{ padding: '24px', backgroundColor: '#ffffff', color: 'var(--color-ink)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <AlertTriangle size={24} color="var(--color-error)" />
              <span className="badge badge-error">{openComplaints.length} Open</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Passenger Grievances</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-body)', margin: 0 }}>
              Review service delays, cleanliness, safety flags, and communicate authoritative responses.
            </p>
          </Link>

          {/* Service Disruptions */}
          <Link href="/admin/disruptions" className="card" style={{ padding: '24px', backgroundColor: '#ffffff', color: 'var(--color-ink)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <Radio size={24} color="var(--color-primary)" />
              <span className="badge badge-warning">Public Broadcast</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Disruption Alerts</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-body)', margin: 0 }}>
              Broadcast road construction, highway diversions, and weather warnings across passenger portals.
            </p>
          </Link>

          {/* System Settings & Audit */}
          <Link href="/admin/settings" className="card" style={{ padding: '24px', backgroundColor: '#ffffff', color: 'var(--color-ink)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <SettingsIcon size={24} color="var(--color-primary)" />
              <span className="badge badge-neutral">Security & Audit</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>System Settings & Data Export</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-body)', margin: 0 }}>
              Institutional rules, integration status, CSV data downloads (Fleet, Trips, Scans), and audit trail.
            </p>
          </Link>

          {/* Live Fleet GPS Telemetry */}
          <Link href="/tracking" className="card" style={{ padding: '24px', backgroundColor: '#ffffff', color: 'var(--color-ink)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <MapPin size={24} color="var(--color-primary)" />
              <span className="badge badge-success">Live Telemetry</span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Live Fleet GPS Radar</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-body)', margin: 0 }}>
              Full-screen corridor map, active vehicle coordinates, speed telemetry, and stale signal detection.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
