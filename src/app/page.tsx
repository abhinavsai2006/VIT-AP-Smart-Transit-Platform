'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bus,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  Shield,
  Radio,
  AlertTriangle,
  QrCode,
  Users,
  Compass,
  CheckCircle2,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Stop, Route, JourneySearchResult, ServiceDisruption, GPSLocation } from '@/types/transit';
import TransitMap from '@/components/map/TransitMap';
import { useAuth } from '@/lib/auth/auth-context';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [disruptions, setDisruptions] = useState<ServiceDisruption[]>([]);
  const [activeLocations, setActiveLocations] = useState<GPSLocation[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Search parameters
  const [originStopId, setOriginStopId] = useState('');
  const [destinationStopId, setDestinationStopId] = useState('');
  const [travelDate, setTravelDate] = useState('2026-10-28');
  const [preferredTime, setPreferredTime] = useState('');
  const [passengers, setPassengers] = useState(1);

  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<JourneySearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [stopsRes, routesRes, disruptRes] = await Promise.all([
          fetch('/api/stops'),
          fetch('/api/routes'),
          fetch('/api/disruptions'),
        ]);

        const stopsData = await stopsRes.json();
        const routesData = await routesRes.json();
        const disruptData = await disruptRes.json();

        setStops(stopsData.stops || []);
        setRoutes(routesData.routes || []);
        setDisruptions(disruptData.disruptions || []);

        // Set default search stops if available
        if (stopsData.stops && stopsData.stops.length >= 2) {
          setOriginStopId('stop-vja-rly'); // Vijayawada Railway Station
          setDestinationStopId('stop-vit-ap-campus'); // VIT-AP Campus
        }

        // Fetch live GPS location for map preview
        const locRes = await fetch('/api/trips/trip-101-morning/location');
        const locData = await locRes.json();
        if (locData.location) {
          setActiveLocations([locData.location]);
        }
      } catch (err) {
        console.error('Failed to load initial transit data', err);
      } finally {
        setLoadingInitial(false);
      }
    }

    loadData();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originStopId || !destinationStopId) {
      setSearchError('Please select both origin and destination stops.');
      return;
    }

    if (originStopId === destinationStopId) {
      setSearchError('Origin and destination stops must be different.');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSearchResults(null);

    try {
      const res = await fetch('/api/journey/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originStopId,
          destinationStopId,
          travelDate,
          preferredTime: preferredTime || undefined,
          passengers: Number(passengers),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || 'Failed to search journeys.');
      } else {
        setSearchResults(data.results || []);
      }
    } catch {
      setSearchError('Network error while searching for services. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      {/* Active Service Disruptions Alert Band */}
      {disruptions.filter((d) => d.status === 'active').length > 0 && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fde68a',
            padding: '12px 0',
          }}
        >
          <div className="container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '13px', color: '#92400e', flex: 1 }}>
              <strong>Transit Notice:</strong>{' '}
              {disruptions.filter((d) => d.status === 'active')[0].title} —{' '}
              {disruptions.filter((d) => d.status === 'active')[0].message}
            </div>
            <Link
              href="/tracking"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#b45309',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              View Live Impact →
            </Link>
          </div>
        </div>
      )}

      {/* Hero Band Dark (From design.md: surface-dark #1a2129, display-xl, 0px border radius) */}
      <section
        style={{
          backgroundColor: 'var(--color-surface-dark)',
          color: 'var(--color-on-dark)',
          paddingTop: '64px',
          paddingBottom: '80px',
        }}
      >
        <div className="container">
          <div style={{ maxWidth: '800px', marginBottom: '40px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(28, 105, 212, 0.25)',
                color: '#60a5fa',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginBottom: '20px',
              }}
            >
              <Radio size={14} className="live-pulse" />
              VIT-AP University Fleet Network • Amaravati, AP
            </div>
            <h1
              style={{
                color: '#ffffff',
                fontSize: 'clamp(2.2rem, 5vw, 3.6rem)',
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                marginBottom: '16px',
              }}
            >
              Smart Campus Transit.
              <br />
              Live Fleet Intelligence.
            </h1>
            <p
              style={{
                color: 'var(--color-on-dark-soft)',
                fontSize: '17px',
                lineHeight: 1.6,
                fontWeight: 300,
              }}
            >
              Comprehensive university bus transportation lifecycle — from route discovery and seat reservations
              to live driver GPS tracking, QR boarding validation, and fleet maintenance across Andhra Pradesh.
            </p>
          </div>

          {/* Journey Search Form Card */}
          <div
            className="card"
            style={{
              backgroundColor: '#ffffff',
              color: 'var(--color-ink)',
              padding: '28px',
              border: 'none',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                borderBottom: '1px solid var(--color-hairline)',
                paddingBottom: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={20} color="var(--color-primary)" />
                <h3 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.5px' }}>
                  SEARCH CAMPUS SERVICES & BUSES
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                Enforces directional stop sequence
              </span>
            </div>

            <form onSubmit={handleSearch}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                  marginBottom: '20px',
                }}
              >
                {/* Origin Stop */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    <MapPin size={13} style={{ display: 'inline', marginRight: 4 }} />
                    Origin Stop
                  </label>
                  <select
                    className="form-select"
                    value={originStopId}
                    onChange={(e) => setOriginStopId(e.target.value)}
                    required
                  >
                    <option value="">Select origin stop...</option>
                    {stops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination Stop */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    <MapPin size={13} style={{ display: 'inline', marginRight: 4 }} />
                    Destination Stop
                  </label>
                  <select
                    className="form-select"
                    value={destinationStopId}
                    onChange={(e) => setDestinationStopId(e.target.value)}
                    required
                  >
                    <option value="">Select destination...</option>
                    {stops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Travel Date */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    <Calendar size={13} style={{ display: 'inline', marginRight: 4 }} />
                    Travel Date
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={travelDate}
                    onChange={(e) => setTravelDate(e.target.value)}
                    required
                  />
                </div>

                {/* Preferred Departure Time */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    <Clock size={13} style={{ display: 'inline', marginRight: 4 }} />
                    Preferred Time
                  </label>
                  <input
                    type="time"
                    className="form-control"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                  />
                </div>

                {/* Passenger Count */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    <Users size={13} style={{ display: 'inline', marginRight: 4 }} />
                    Passengers
                  </label>
                  <select
                    className="form-select"
                    value={passengers}
                    onChange={(e) => setPassengers(Number(e.target.value))}
                  >
                    <option value={1}>1 Passenger</option>
                    <option value={2}>2 Passengers</option>
                    <option value={3}>3 Passengers</option>
                    <option value={4}>4 Passengers</option>
                  </select>
                </div>
              </div>

              {searchError && (
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
                  <strong>Search Notice:</strong> {searchError}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                  Active user: <strong>{user.fullName}</strong> ({user.role})
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={searching}
                  style={{ minWidth: '200px' }}
                >
                  {searching ? 'Finding Services...' : 'Find Matching Services ›'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Search Results Section */}
      {searchResults !== null && (
        <section style={{ padding: '64px 0', backgroundColor: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-hairline)' }}>
          <div className="container">
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800 }}>
                  Available Services ({searchResults.length})
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--color-muted)', margin: 0 }}>
                  Direct single-leg services servicing your selected origin to destination in travel direction.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSearchResults(null)}
              >
                Clear Results
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div
                className="card"
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  backgroundColor: '#ffffff',
                }}
              >
                <AlertTriangle size={40} color="var(--color-warning)" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                  No Direct Service Found for Selected Route & Direction
                </h3>
                <p style={{ maxWidth: '540px', margin: '0 auto 16px', fontSize: '14px', color: 'var(--color-body)' }}>
                  There are no scheduled trips servicing this stop pair in this travel direction on {travelDate}.
                  Buses on this route may run in the opposite direction or requires an alternative transfer at Mangalagiri Bypass.
                </p>
                <Link href="/routes" className="btn btn-secondary btn-sm">
                  View Full Campus Route Timetable
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {searchResults.map((res) => (
                  <div
                    key={res.trip.id}
                    className="card"
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--color-hairline-strong)',
                      padding: '24px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        borderBottom: '1px solid var(--color-hairline)',
                        paddingBottom: '16px',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            backgroundColor: 'var(--color-primary)',
                            color: '#ffffff',
                            padding: '6px 12px',
                            fontWeight: 800,
                            fontSize: '15px',
                          }}
                        >
                          ROUTE {res.route.routeNumber}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{res.route.routeName}</h3>
                          <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                            Vehicle: <strong>{res.trip.bus?.busCode || 'Campus Bus'}</strong> ({res.trip.bus?.registrationNumber || 'AP Registered'}) • {res.trip.bus?.vehicleType}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className="badge badge-success" style={{ fontSize: '11px' }}>
                          {res.trip.status.toUpperCase()}
                        </span>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-ink)' }}>
                            {res.fareAmount === 0 ? 'FREE' : `₹${res.fareAmount}`}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>per passenger</div>
                        </div>
                      </div>
                    </div>

                    {/* Schedule & Stops Sequence */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '16px',
                        marginBottom: '20px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                          Departure From Origin
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-ink)' }}>
                          {res.departureTime}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-body)' }}>{res.originStop.name}</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: '12px', color: 'var(--color-muted)', textAlign: 'center', marginBottom: '4px' }}>
                          ~{res.estimatedDurationMinutes} mins duration
                        </div>
                        <div style={{ height: '2px', backgroundColor: 'var(--color-hairline-strong)', position: 'relative' }}>
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '-4px',
                              width: '10px',
                              height: '10px',
                              backgroundColor: 'var(--color-primary)',
                              borderRadius: '50%',
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                          Estimated Arrival
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-ink)' }}>
                          {res.arrivalTime}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-body)' }}>{res.destinationStop.name}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
                          Seat Capacity
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: res.availableSeats > 5 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                          {res.availableSeats} of {res.totalSeats} seats open
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                          Driver: {res.trip.driver?.fullName || 'Assigned Crew'}
                        </div>
                      </div>
                    </div>

                    {/* Book Action */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '16px',
                        borderTop: '1px solid var(--color-hairline)',
                      }}
                    >
                      <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                        Instant QR Ticket generated on reservation.
                      </div>
                      <Link
                        href={`/booking?tripId=${res.trip.id}&originStopId=${res.originStop.id}&destinationStopId=${res.destinationStop.id}&seats=${passengers}`}
                        className="btn btn-primary btn-sm"
                        style={{ minWidth: '180px' }}
                      >
                        Reserve Seat Now ›
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Live Fleet Tracking Map Preview */}
      <section style={{ padding: '80px 0' }}>
        <div className="container">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
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
                  marginBottom: '8px',
                }}
              >
                Real-Time Telemetry
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>Campus Fleet Operations Map</h2>
              <p style={{ fontSize: '15px', color: 'var(--color-muted)', margin: 0 }}>
                Live GPS ingestion directly from active driver devices servicing Vijayawada, Guntur, and Amaravati corridors.
              </p>
            </div>
            <Link href="/tracking" className="btn btn-secondary btn-sm">
              Open Full Live Tracking Console ›
            </Link>
          </div>

          {!loadingInitial && (
            <TransitMap
              stops={stops}
              routes={routes}
              activeLocations={activeLocations}
              height="450px"
            />
          )}
        </div>
      </section>

      {/* Key Features & Portals Grid (From design.md: 4-up card grid, crisp cards, 0px border radius) */}
      <section style={{ padding: '80px 0', backgroundColor: 'var(--color-surface-soft)', borderTop: '1px solid var(--color-hairline)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 48px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '12px' }}>
              Connected Transit Ecosystem
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--color-body)' }}>
              Unified backend ensuring synchronization between student bookings, live driver positions, conductor QR scanners, and transport administration.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '24px',
            }}
          >
            {/* Feature 1 */}
            <div className="card" style={{ backgroundColor: '#ffffff', padding: '28px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  backgroundColor: 'var(--color-surface-soft)',
                  border: '1px solid var(--color-hairline-strong)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                }}
              >
                <QrCode size={24} color="var(--color-primary)" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
                Signed QR Ticketing
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--color-body)', lineHeight: 1.6, marginBottom: '16px' }}>
                Cryptographically signed HMAC-SHA256 tokens. Atomic server-side consumption preventing duplicate boardings.
              </p>
              <Link href="/tickets" className="btn-text-link">
                View Ticket Wallet ›
              </Link>
            </div>

            {/* Feature 2 */}
            <div className="card" style={{ backgroundColor: '#ffffff', padding: '28px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  backgroundColor: 'var(--color-surface-soft)',
                  border: '1px solid var(--color-hairline-strong)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                }}
              >
                <Radio size={24} color="var(--color-primary)" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
                Real Driver GPS Tracking
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--color-body)', lineHeight: 1.6, marginBottom: '16px' }}>
                Continuous location updates from active assigned drivers with automatic stale data detection and speed reporting.
              </p>
              <Link href="/tracking" className="btn-text-link">
                Track Active Fleet ›
              </Link>
            </div>

            {/* Feature 3 */}
            <div className="card" style={{ backgroundColor: '#ffffff', padding: '28px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  backgroundColor: 'var(--color-surface-soft)',
                  border: '1px solid var(--color-hairline-strong)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                }}
              >
                <Shield size={24} color="var(--color-primary)" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
                Fleet & AP Registration
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--color-body)', lineHeight: 1.6, marginBottom: '16px' }}>
                MoRTH and Andhra Pradesh transport code validation, preventive maintenance logs, and document expiry alerts.
              </p>
              <Link href="/admin/fleet" className="btn-text-link">
                Fleet Management ›
              </Link>
            </div>

            {/* Feature 4 */}
            <div className="card" style={{ backgroundColor: '#ffffff', padding: '28px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  backgroundColor: 'var(--color-surface-soft)',
                  border: '1px solid var(--color-hairline-strong)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                }}
              >
                <Users size={24} color="var(--color-primary)" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
                Special Event Shuttles
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--color-body)', lineHeight: 1.6, marginBottom: '16px' }}>
                Conference, hackathon, and railway station shuttles (including Kharagpur event link) with department approval workflows.
              </p>
              <Link href="/events" className="btn-text-link">
                Event Logistics ›
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pre-footer CTA Band (From design.md: cta-band-photo on surface-dark) */}
      <section
        style={{
          backgroundColor: 'var(--color-surface-dark)',
          color: '#ffffff',
          padding: '80px 0',
          textAlign: 'center',
        }}
      >
        <div className="container" style={{ maxWidth: '720px' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
            Experience VIT-AP Smart Transit Operations
          </h2>
          <p style={{ color: 'var(--color-on-dark-soft)', fontSize: '16px', lineHeight: 1.6, marginBottom: '32px' }}>
            Switch between Student, Faculty, Driver, Conductor, Coordinator, and Transport Administrator roles
            using the top-right demo switcher to test the entire university transit lifecycle.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/routes" className="btn btn-primary">
              Explore Campus Routes ›
            </Link>
            <Link href="/admin" className="btn btn-outline-dark">
              Transport Admin Console ›
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
