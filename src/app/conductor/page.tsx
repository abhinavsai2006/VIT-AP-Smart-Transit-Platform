'use client';

import React, { useState, useEffect } from 'react';
import { Trip, BoardingScan } from '@/types/transit';
import { useAuth } from '@/lib/auth/auth-context';
import QrScannerModal from '@/components/qr/QrScannerModal';
import {
  QrCode,
  CheckCircle,
  AlertOctagon,
  Users,
  Bus as BusIcon,
  Clock,
  ShieldCheck,
  RefreshCw,
  Search,
} from 'lucide-react';

export default function ConductorPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanHistory, setScanHistory] = useState<BoardingScan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTripsAndScans = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/trips');
      const data = await res.json();
      setTrips(data.trips || []);
    } catch (err) {
      console.error('Failed to load trips for conductor', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripsAndScans();
  }, []);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || trips[0];

  const handleScanCompleted = (scan: BoardingScan) => {
    setScanHistory((prev) => [scan, ...prev]);
    // Refresh trips to update passenger boarding counts
    fetchTripsAndScans();
  };

  const getResultBadge = (result: BoardingScan['scanResult']) => {
    switch (result) {
      case 'valid':
        return <span className="badge badge-success">VALID • BOARDED</span>;
      case 'already_used':
        return <span className="badge badge-error">DUPLICATE • PREVIOUSLY USED</span>;
      case 'wrong_trip':
        return <span className="badge badge-warning">WRONG TRIP / ROUTE</span>;
      case 'cancelled':
        return <span className="badge badge-error">CANCELLED TICKET</span>;
      default:
        return <span className="badge badge-error">INVALID TOKEN</span>;
    }
  };

  return (
    <div style={{ padding: '48px 0', minHeight: '80vh' }}>
      <div className="container" style={{ maxWidth: '960px' }}>
        {/* Header */}
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
                <QrCode size={28} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#93c5fd', fontWeight: 700 }}>
                  Assigned Ticket Validator
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, marginTop: '2px' }}>
                  {user.fullName} (Conductor Console)
                </h1>
                <div style={{ fontSize: '12px', color: 'var(--color-on-dark-soft)', marginTop: '2px' }}>
                  Staff ID: <strong>{user.employeeId || 'CND-201'}</strong> • Passenger Service Division
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsScannerOpen(true)}
            >
              <QrCode size={16} /> Open Camera QR Scanner ›
            </button>
          </div>
        </div>

        {/* Selected Trip Selector & Manifest Stat Plate */}
        {selectedTrip && (
          <div className="card" style={{ padding: '28px', marginBottom: '32px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                  Assigned Bus Manifest
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px' }}>
                  Route {selectedTrip.route?.routeNumber}: {selectedTrip.route?.routeName}
                </h2>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  className="form-select"
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  style={{ height: '40px', fontSize: '13px', width: 'auto' }}
                >
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      Trip #{t.id} ({t.departureTime}) - {t.bus?.busCode}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Boarding Counter Metrics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                backgroundColor: 'var(--color-surface-soft)',
                padding: '20px',
                marginBottom: '24px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Assigned Bus & Reg
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>
                  {selectedTrip.bus?.busCode}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                  {selectedTrip.bus?.registrationNumber}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Boarded Manifest
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
                  {selectedTrip.bookedSeats} / {selectedTrip.totalSeats} Passengers
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                  {Math.max(0, selectedTrip.totalSeats - selectedTrip.bookedSeats)} seats remaining
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Duplicate Scans Caught
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-error)', marginTop: '2px' }}>
                  {scanHistory.filter((s) => s.scanResult === 'already_used').length}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                  Server atomic protection active
                </div>
              </div>
            </div>

            {/* Big Launch Scanner Action */}
            <div
              style={{
                textAlign: 'center',
                padding: '32px',
                backgroundColor: 'var(--color-surface-card)',
                border: '1px dashed var(--color-hairline-strong)',
              }}
            >
              <QrCode size={40} color="var(--color-primary)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
                Activate Boarding Ticket Scanner
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', maxWidth: '440px', margin: '0 auto 20px' }}>
                Use phone camera or token input. The server cryptographically validates each QR token and atomically marks it as consumed.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => setIsScannerOpen(true)}
              >
                Launch QR Camera Scanner Now ›
              </button>
            </div>
          </div>
        )}

        {/* Boarding History & Scan Log Table */}
        <div className="card" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
            Boarding Scan Audit Trail (This Session)
          </h3>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Ticket / Token</th>
                  <th>Passenger</th>
                  <th>Validation Result</th>
                  <th>Audit Notes</th>
                </tr>
              </thead>
              <tbody>
                {scanHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-muted)' }}>
                      No tickets scanned in this session yet. Launch the scanner to validate boarding passengers.
                    </td>
                  </tr>
                ) : (
                  scanHistory.map((scan) => (
                    <tr key={scan.id}>
                      <td style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                        {new Date(scan.scannedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td style={{ fontWeight: 700 }}>{scan.ticketNumber || scan.ticketId}</td>
                      <td>{scan.passengerName || 'Passenger'}</td>
                      <td>{getResultBadge(scan.scanResult)}</td>
                      <td style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                        {scan.notes}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scanner Modal */}
        <QrScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          tripId={selectedTrip?.id || ''}
          staffId={user.employeeId || 'CND-201'}
          onScanComplete={handleScanCompleted}
        />
      </div>
    </div>
  );
}
