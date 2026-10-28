'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trip, Route, Bus, StaffProfile } from '@/types/transit';
import {
  Compass,
  PlusCircle,
  Calendar,
  Clock,
  Bus as BusIcon,
  Users,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Search,
} from 'lucide-react';

export default function AdminTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // New Trip Modal
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [routeId, setRouteId] = useState('');
  const [busId, setBusId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [conductorId, setConductorId] = useState('');
  const [travelDate, setTravelDate] = useState('2026-10-28');
  const [departureTime, setDepartureTime] = useState('08:00');
  const [arrivalTime, setArrivalTime] = useState('08:45');
  const [operationalNotes, setOperationalNotes] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tripsRes, routesRes, busesRes] = await Promise.all([
        fetch('/api/trips'),
        fetch('/api/routes'),
        fetch('/api/fleet'),
      ]);
      const tripsData = await tripsRes.json();
      const routesData = await routesRes.json();
      const busesData = await busesRes.json();

      setTrips(tripsData.trips || []);
      setRoutes(routesData.routes || []);
      setBuses(busesData.buses || []);

      if (routesData.routes && routesData.routes.length > 0 && !routeId) {
        setRouteId(routesData.routes[0].id);
      }
      if (busesData.buses && busesData.buses.length > 0 && !busId) {
        setBusId(busesData.buses[0].id);
      }
    } catch (err) {
      console.error('Failed to load dispatch operations data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDispatchTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    setSubmitting(true);

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId,
          busId,
          driverId: driverId || 'staff-drv-1',
          conductorId: conductorId || 'staff-cnd-1',
          travelDate,
          departureTime,
          arrivalTime,
          operationalNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFormSuccess('New service scheduled and published to passenger portals.');
        setShowDispatchModal(false);
        await fetchData();
      } else {
        setFormError(data.error || 'Failed to dispatch trip.');
      }
    } catch {
      setFormError('Network communication error while scheduling trip.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeBusesOnly = buses.filter((b) => b.status === 'active');

  return (
    <div style={{ padding: '48px 0', minHeight: '80vh' }}>
      <div className="container">
        {/* Breadcrumb */}
        <div style={{ marginBottom: '16px' }}>
          <Link href="/admin" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
            ← Back to Admin Console
          </Link>
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: 'var(--color-primary)',
                marginBottom: '6px',
              }}
            >
              Operations Management
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '8px' }}>
              Trip Scheduling & Dispatch Console
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '760px', margin: 0 }}>
              Dispatch campus bus trips, enforce vehicle maintenance status checks, prevent driver scheduling conflicts, and manage real-time passenger capacities.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowDispatchModal(true)}
          >
            <PlusCircle size={16} /> Schedule New Trip ›
          </button>
        </div>

        {formSuccess && (
          <div
            style={{
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              padding: '12px 16px',
              fontSize: '13px',
              marginBottom: '24px',
            }}
          >
            {formSuccess}
          </div>
        )}

        {/* Trips Table */}
        <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
            Scheduled Services & Real-Time Capacity ({trips.length})
          </h2>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Trip ID</th>
                  <th>Route</th>
                  <th>Date & Timing</th>
                  <th>Assigned Vehicle</th>
                  <th>Driver & Conductor</th>
                  <th>Booked Manifest</th>
                  <th>Status</th>
                  <th>Operational Notes</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{t.id}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>
                        Route {t.route?.routeNumber}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                        {t.route?.routeName}
                      </div>
                    </td>
                    <td>
                      <div><strong>{t.travelDate}</strong></div>
                      <div style={{ fontSize: '12px', color: 'var(--color-body)' }}>
                        {t.departureTime} → {t.arrivalTime} IST
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{t.bus?.busCode}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                        {t.bus?.registrationNumber} ({t.bus?.vehicleType})
                      </div>
                    </td>
                    <td>
                      <div><strong>Drv:</strong> {t.driver?.fullName || 'Assigned'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                        <strong>Cnd:</strong> {t.conductor?.fullName || 'Assigned'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>
                        {t.bookedSeats} / {t.totalSeats} seats
                      </div>
                      <div style={{ fontSize: '11px', color: t.totalSeats - t.bookedSeats > 5 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                        {t.totalSeats - t.bookedSeats} available
                      </div>
                    </td>
                    <td>
                      {t.status === 'in_progress' ? (
                        <span className="badge badge-success">IN PROGRESS</span>
                      ) : t.status === 'scheduled' ? (
                        <span className="badge badge-info">SCHEDULED</span>
                      ) : (
                        <span className="badge badge-neutral">{t.status.toUpperCase()}</span>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-muted)', maxWidth: '200px' }}>
                      {t.operationalNotes || 'Standard timetable service.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Schedule Trip */}
        {showDispatchModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(26, 33, 41, 0.85)',
              zIndex: 4000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              className="card"
              style={{
                maxWidth: '620px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '32px',
                backgroundColor: '#ffffff',
              }}
            >
              <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>
                Dispatch & Schedule New Service
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '20px' }}>
                Enforces vehicle maintenance availability and prevents overlapping driver/vehicle conflict.
              </p>

              {formError && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '12px',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  {formError}
                </div>
              )}

              <form onSubmit={handleDispatchTrip}>
                <div className="form-group">
                  <label className="form-label">Select Corridor Route</label>
                  <select
                    className="form-select"
                    value={routeId}
                    onChange={(e) => setRouteId(e.target.value)}
                    required
                  >
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        Route {r.routeNumber}: {r.routeName} (~{r.estimatedDurationMinutes} mins)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Vehicle (Active Fleet Only)</label>
                  <select
                    className="form-select"
                    value={busId}
                    onChange={(e) => setBusId(e.target.value)}
                    required
                  >
                    {activeBusesOnly.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.busCode} — {b.registrationNumber} ({b.seatingCapacity} seats, {b.vehicleType})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Driver Assigned</label>
                    <select
                      className="form-select"
                      value={driverId}
                      onChange={(e) => setDriverId(e.target.value)}
                    >
                      <option value="staff-drv-1">Ramesh Kumar (DRV-101)</option>
                      <option value="staff-drv-2">Suresh Naidu (DRV-102)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Conductor Assigned</label>
                    <select
                      className="form-select"
                      value={conductorId}
                      onChange={(e) => setConductorId(e.target.value)}
                    >
                      <option value="staff-cnd-1">Lakshmi Devi (CND-201)</option>
                      <option value="staff-cnd-2">K. Appa Rao (CND-202)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Travel Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={travelDate}
                      onChange={(e) => setTravelDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Departure</label>
                    <input
                      type="time"
                      className="form-control"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Arrival</label>
                    <input
                      type="time"
                      className="form-control"
                      value={arrivalTime}
                      onChange={(e) => setArrivalTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Operational Dispatch Notes</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Peak student morning express via Benz Circle"
                    value={operationalNotes}
                    onChange={(e) => setOperationalNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowDispatchModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={submitting}
                  >
                    {submitting ? 'Verifying Conflicts...' : 'Publish Trip to Timetable ›'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
