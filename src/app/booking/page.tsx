'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Trip, Stop, Booking } from '@/types/transit';
import { useAuth } from '@/lib/auth/auth-context';
import {
  Ticket,
  Bus,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react';

function BookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const tripIdParam = searchParams.get('tripId') || '';
  const originStopIdParam = searchParams.get('originStopId') || '';
  const destStopIdParam = searchParams.get('destinationStopId') || 'stop-vit-ap-campus';
  const seatsParam = Number(searchParams.get('seats') || 1);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [selectedTripId, setSelectedTripId] = useState(tripIdParam);
  const [originStopId, setOriginStopId] = useState(originStopIdParam);
  const [destinationStopId, setDestinationStopId] = useState(destStopIdParam);
  const [seatCount, setSeatCount] = useState(seatsParam);

  const [passengerName, setPassengerName] = useState(user.fullName || '');
  const [passengerEmail, setPassengerEmail] = useState(user.email || '');
  const [passengerPhone, setPassengerPhone] = useState(user.phone || '+91 98765 43210');
  const [regNumber, setRegNumber] = useState(user.regNumber || user.employeeId || '22BCE1245');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [tripsRes, stopsRes] = await Promise.all([
          fetch('/api/trips'),
          fetch('/api/stops'),
        ]);
        const tripsData = await tripsRes.json();
        const stopsData = await stopsRes.json();
        setTrips(tripsData.trips || []);
        setStops(stopsData.stops || []);
      } catch (err) {
        console.error('Failed to load trips for booking', err);
      }
    }
    loadData();
  }, []);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || trips[0];
  const originStop = stops.find((s) => s.id === originStopId) || stops[0];
  const destStop = stops.find((s) => s.id === destinationStopId) || stops[stops.length - 1];

  const availableSeats = selectedTrip ? Math.max(0, selectedTrip.totalSeats - selectedTrip.bookedSeats) : 0;
  const farePerSeat = selectedTrip?.route?.fareAmount || 0;
  const totalFare = farePerSeat * seatCount;

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip) return;

    if (seatCount > availableSeats) {
      setError(`Cannot reserve ${seatCount} seats. Only ${availableSeats} remaining.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          tripId: selectedTrip.id,
          passengerName,
          passengerEmail,
          passengerPhone,
          passengerType: user.role,
          originStopId,
          destinationStopId,
          seatCount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Booking reservation failed.');
      } else {
        setConfirmedBooking(data.booking);
      }
    } catch {
      setError('Network communication failed. Please check connection and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmedBooking) {
    return (
      <div style={{ padding: '64px 0', minHeight: '80vh' }}>
        <div className="container" style={{ maxWidth: '640px' }}>
          <div
            className="card"
            style={{
              textAlign: 'center',
              padding: '40px 32px',
              border: '2px solid var(--color-success)',
              backgroundColor: '#ffffff',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <CheckCircle size={36} />
            </div>

            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-success)', marginBottom: '8px' }}>
              RESERVATION AUTHORIZED & CONFIRMED
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '8px' }}>
              Booking Reference: {confirmedBooking.bookingReference}
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--color-muted)', marginBottom: '24px' }}>
              Your seat has been reserved on the server. A cryptographically signed QR ticket is ready for boarding inspection.
            </p>

            {/* Ticket Summary Plate */}
            <div
              style={{
                backgroundColor: 'var(--color-surface-soft)',
                border: '1px solid var(--color-hairline-strong)',
                padding: '20px',
                textAlign: 'left',
                marginBottom: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Passenger</span>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>{confirmedBooking.passengerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Service Route</span>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>
                  Route {confirmedBooking.trip?.route?.routeNumber} ({confirmedBooking.trip?.route?.routeName})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Departure Time</span>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>{confirmedBooking.trip?.departureTime} IST</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Total Reserved</span>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>{confirmedBooking.seatCount} Seat(s)</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <Link href="/tickets" className="btn btn-primary" style={{ flex: 1 }}>
                <QrCode size={18} /> View QR Ticket Wallet ›
              </Link>
              <Link href="/tracking" className="btn btn-secondary">
                Track Bus Live
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '48px 0', minHeight: '80vh' }}>
      <div className="container" style={{ maxWidth: '960px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
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
            Reservation Desk
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '8px' }}>
            Book University Transit Seat
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--color-muted)', margin: 0 }}>
            Reserve seats on scheduled campus express and inter-city university bus routes.
          </p>
        </div>

        {/* 2-Column: Booking Form + Trip Summary Card */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '32px',
            alignItems: 'start',
          }}
        >
          {/* Form */}
          <div className="card" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', borderBottom: '1px solid var(--color-hairline)', paddingBottom: '12px' }}>
              Passenger & Journey Details
            </h2>

            <form onSubmit={handleBookingSubmit}>
              {/* Select Trip */}
              <div className="form-group">
                <label className="form-label">Selected Scheduled Trip</label>
                <select
                  className="form-select"
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  required
                >
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      Route {t.route?.routeNumber} ({t.departureTime} dep) — Bus {t.bus?.busCode} ({t.totalSeats - t.bookedSeats} seats open)
                    </option>
                  ))}
                </select>
              </div>

              {/* Origin & Destination */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Boarding Stop</label>
                  <select
                    className="form-select"
                    value={originStopId}
                    onChange={(e) => setOriginStopId(e.target.value)}
                    required
                  >
                    {stops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Drop Stop</label>
                  <select
                    className="form-select"
                    value={destinationStopId}
                    onChange={(e) => setDestinationStopId(e.target.value)}
                    required
                  >
                    {stops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Passenger Info */}
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Registration / Employee No.</label>
                  <input
                    type="text"
                    className="form-control"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    placeholder="e.g. 22BCE1245"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Seats to Reserve</label>
                  <select
                    className="form-select"
                    value={seatCount}
                    onChange={(e) => setSeatCount(Number(e.target.value))}
                  >
                    <option value={1}>1 Seat</option>
                    <option value={2}>2 Seats</option>
                    <option value={3}>3 Seats</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={passengerPhone}
                    onChange={(e) => setPassengerPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={passengerEmail}
                    onChange={(e) => setPassengerEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '12px 16px',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || availableSeats <= 0}
                style={{ width: '100%', marginTop: '8px' }}
              >
                {submitting ? 'Confirming with Server...' : 'Confirm Reservation & Generate QR Ticket ›'}
              </button>
            </form>
          </div>

          {/* Right Column: Trip Policy & Pricing Card */}
          <div style={{ position: 'sticky', top: '80px' }}>
            <div className="card-soft" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--color-hairline)', paddingBottom: '10px' }}>
                Trip & Capacity Summary
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--color-muted)' }}>Assigned Vehicle</span>
                  <span style={{ fontWeight: 700 }}>
                    {selectedTrip?.bus?.busCode} ({selectedTrip?.bus?.registrationNumber})
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--color-muted)' }}>Vehicle Type</span>
                  <span>{selectedTrip?.bus?.vehicleType}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--color-muted)' }}>Departure Time</span>
                  <span style={{ fontWeight: 700 }}>{selectedTrip?.departureTime} IST</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--color-muted)' }}>Available Seats</span>
                  <span style={{ fontWeight: 700, color: availableSeats > 5 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                    {availableSeats} of {selectedTrip?.totalSeats} seats
                  </span>
                </div>
              </div>

              <div
                style={{
                  borderTop: '2px solid var(--color-hairline-strong)',
                  paddingTop: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Payable
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-ink)' }}>
                    {totalFare === 0 ? 'FREE (CAMPUS SHUTTLE)' : `₹${totalFare}`}
                  </div>
                </div>
                <span className="badge badge-success">UNIVERSITY SUBSIDIZED</span>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.6 }}>
                <strong>Boarding Policy:</strong> Please present your QR ticket from your phone to the conductor upon boarding. Duplicate scans are automatically rejected by server atomic validation.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>Loading booking details...</div>}>
      <BookingContent />
    </Suspense>
  );
}
