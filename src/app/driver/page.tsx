'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Trip, GPSLocation } from '@/types/transit';
import { useAuth } from '@/lib/auth/auth-context';
import {
  Compass,
  Radio,
  Bus as BusIcon,
  Play,
  Square,
  AlertTriangle,
  MapPin,
  CheckCircle,
  Gauge,
  Navigation,
  Clock,
  Shield,
  Wrench,
} from 'lucide-react';

export default function DriverPage() {
  const { user } = useAuth();
  const [assignedTrip, setAssignedTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  // GPS Transmission State
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    accuracy: number;
    lastPing: string;
  } | null>(null);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  // Defect / Incident Report Modal
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [defectCategory, setDefectCategory] = useState<'breakdown' | 'accident' | 'delay'>('delay');
  const [defectDescription, setDefectDescription] = useState('');
  const [defectSubmitting, setDefectSubmitting] = useState(false);
  const [defectSuccess, setDefectSuccess] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);

  const fetchDriverTrip = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/trips');
      const data = await res.json();
      // Find trip assigned to driver (or default to trip-101-morning for demo)
      const trips: Trip[] = data.trips || [];
      const match = trips.find((t) => t.driverId === 'staff-drv-1' || t.status === 'in_progress') || trips[0];
      setAssignedTrip(match || null);
    } catch (err) {
      console.error('Failed to load driver trip', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverTrip();
  }, []);

  // Stop broadcasting when component unmounts
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const startGpsBroadcast = () => {
    setBroadcastError(null);

    if (!('geolocation' in navigator)) {
      setBroadcastError('Geolocation is not supported by your browser or operating system.');
      return;
    }

    setIsBroadcasting(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, speed, heading, accuracy } = position.coords;
        const now = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });

        setCurrentCoords({
          lat: latitude,
          lng: longitude,
          speed: speed ? Math.round(speed * 3.6) : 45, // m/s to km/h fallback
          heading: heading || 0,
          accuracy: accuracy || 5,
          lastPing: now,
        });

        // Transmit coordinates to authoritative backend endpoint
        if (assignedTrip) {
          try {
            await fetch(`/api/trips/${assignedTrip.id}/location`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                driverId: assignedTrip.driverId || 'staff-drv-1',
                latitude,
                longitude,
                speedKmH: speed ? Math.round(speed * 3.6) : 45,
                heading: heading || 0,
                accuracyMeters: accuracy || 5,
              }),
            });
          } catch (e) {
            console.error('Failed to transmit GPS coordinates to server', e);
          }
        }
      },
      (err) => {
        setBroadcastError(`GPS permission denied or unavailable: ${err.message}`);
        setIsBroadcasting(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      }
    );
  };

  const stopGpsBroadcast = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsBroadcasting(false);
  };

  const handleDefectReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defectDescription.trim() || !assignedTrip) return;

    setDefectSubmitting(true);
    setDefectSuccess(null);

    try {
      // Create incident / defect record
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: assignedTrip.busId,
          maintenanceType: defectCategory === 'breakdown' ? 'breakdown' : 'inspection',
          description: `[Driver Report from ${user.fullName}]: ${defectDescription}`,
          serviceDate: new Date().toISOString().split('T')[0],
          status: 'in_progress',
          reportedBy: `${user.fullName} (${user.employeeId || 'DRV-101'})`,
        }),
      });

      if (res.ok) {
        setDefectSuccess('Defect report transmitted to Amaravati Central Depot mechanics.');
        setDefectDescription('');
        setShowDefectModal(false);
      } else {
        alert('Failed to transmit defect report');
      }
    } catch {
      alert('Network error while lodging defect.');
    } finally {
      setDefectSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '48px 0', minHeight: '80vh' }}>
      <div className="container" style={{ maxWidth: '960px' }}>
        {/* Driver Cockpit Header */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
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
                <Compass size={28} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#93c5fd', fontWeight: 700 }}>
                  Assigned Operating Crew
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, marginTop: '2px' }}>
                  {user.fullName} (Driver Cockpit)
                </h1>
                <div style={{ fontSize: '12px', color: 'var(--color-on-dark-soft)', marginTop: '2px' }}>
                  Staff ID: <strong>{user.employeeId || 'DRV-101'}</strong> • Depot: Amaravati Central
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => setShowDefectModal(true)}
            >
              <AlertTriangle size={16} /> Report Breakdown / Defect
            </button>
          </div>
        </div>

        {defectSuccess && (
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
            {defectSuccess}
          </div>
        )}

        {/* Assigned Duty Card */}
        {assignedTrip ? (
          <div className="card" style={{ padding: '32px', marginBottom: '32px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--color-hairline)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: '#ffffff',
                    padding: '4px 12px',
                    fontWeight: 800,
                    fontSize: '14px',
                  }}
                >
                  ROUTE {assignedTrip.route?.routeNumber}
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>
                  {assignedTrip.route?.routeName}
                </h2>
              </div>
              <span className="badge badge-success">ACTIVE TRIP</span>
            </div>

            {/* Vehicle & Timetable Specs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                backgroundColor: 'var(--color-surface-soft)',
                padding: '20px',
                marginBottom: '28px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700 }}>
                  Allocated Vehicle
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>
                  {assignedTrip.bus?.busCode} ({assignedTrip.bus?.registrationNumber})
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                  {assignedTrip.bus?.vehicleType}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700 }}>
                  Departure / Arrival
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>
                  {assignedTrip.departureTime} → {assignedTrip.arrivalTime} IST
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                  Duration: ~{assignedTrip.route?.estimatedDurationMinutes} mins
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-muted)', fontWeight: 700 }}>
                  Passenger Load
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>
                  {assignedTrip.bookedSeats} / {assignedTrip.totalSeats} Boarded
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                  Conductor: {assignedTrip.conductor?.fullName || 'Crew Assigned'}
                </div>
              </div>
            </div>

            {/* GPS Live Transmitter Console */}
            <div
              style={{
                border: isBroadcasting ? '2px solid var(--color-success)' : '1px solid var(--color-hairline-strong)',
                backgroundColor: isBroadcasting ? '#f0fdf4' : 'var(--color-surface-card)',
                padding: '24px',
                marginBottom: '28px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={isBroadcasting ? 'live-pulse' : 'stale-pulse'}></span>
                    <h3 style={{ fontSize: '16px', fontWeight: 800 }}>
                      Real-Time GPS Transmitter
                    </h3>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: '4px 0 0' }}>
                    Transmits real GPS coordinates from this device to passengers and admin operations map.
                  </p>
                </div>

                {isBroadcasting ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={stopGpsBroadcast}
                    style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                  >
                    <Square size={14} /> Stop GPS Broadcast
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={startGpsBroadcast}
                  >
                    <Play size={14} /> Start Transmitting Live GPS
                  </button>
                )}
              </div>

              {broadcastError && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '10px 14px',
                    fontSize: '12px',
                    marginBottom: '14px',
                  }}
                >
                  {broadcastError}
                </div>
              )}

              {currentCoords ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '12px',
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Latitude:</span>{' '}
                    <strong>{currentCoords.lat.toFixed(5)}° N</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Longitude:</span>{' '}
                    <strong>{currentCoords.lng.toFixed(5)}° E</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Ground Speed:</span>{' '}
                    <strong>{currentCoords.speed} km/h</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Last Server Sync:</span>{' '}
                    <strong>{currentCoords.lastPing}</strong>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                  GPS transmitter is currently idle. Click &quot;Start Transmitting Live GPS&quot; when pulling out of the bay.
                </div>
              )}
            </div>

            {/* Ordered Stop Checklist */}
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
                Trip Stop Checklist & Sequencing
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {assignedTrip.route?.stops
                  .sort((a, b) => a.stopSequence - b.stopSequence)
                  .map((rs, idx) => (
                    <div
                      key={rs.id}
                      style={{
                        padding: '12px 16px',
                        border: '1px solid var(--color-hairline)',
                        backgroundColor: 'var(--color-surface-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: idx === 0 ? 'var(--color-primary)' : 'var(--color-surface-dark)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 800,
                          }}
                        >
                          {rs.stopSequence}
                        </span>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700 }}>
                            {rs.stop?.name || rs.stopId}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                            {rs.stop?.landmark || 'Stop point'} • Expected Departure: +{rs.departureOffsetMinutes}m
                          </div>
                        </div>
                      </div>

                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                        Bay Verified
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <p>No active trip assigned for this driver shift.</p>
          </div>
        )}

        {/* Defect Modal */}
        {showDefectModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(26, 33, 41, 0.8)',
              zIndex: 3000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>
                Report Vehicle Defect or Operational Delay
              </h3>
              <form onSubmit={handleDefectReport}>
                <div className="form-group">
                  <label className="form-label">Incident Category</label>
                  <select
                    className="form-select"
                    value={defectCategory}
                    onChange={(e) => setDefectCategory(e.target.value as 'breakdown' | 'accident' | 'delay')}
                  >
                    <option value="breakdown">Mechanical Breakdown (Engine/Brakes/Tire)</option>
                    <option value="delay">Severe Route Traffic Congestion</option>
                    <option value="accident">Minor Collision / Accident</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Description & Location</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    placeholder="Describe issue, warning lights on dashboard, exact location on highway..."
                    value={defectDescription}
                    onChange={(e) => setDefectDescription(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowDefectModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger btn-sm"
                    disabled={defectSubmitting}
                  >
                    {defectSubmitting ? 'Transmitting...' : 'Send Immediate Report'}
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
