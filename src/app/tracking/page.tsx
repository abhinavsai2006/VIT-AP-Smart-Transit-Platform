'use client';

import React, { useState, useEffect } from 'react';
import { Route, Stop, Trip, GPSLocation, Bus, ServiceDisruption } from '@/types/transit';
import TransitMap from '@/components/map/TransitMap';
import {
  Radio,
  Bus as BusIcon,
  Clock,
  Gauge,
  Navigation,
  AlertTriangle,
  RefreshCw,
  MapPin,
  CheckCircle2,
} from 'lucide-react';

export default function TrackingPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [disruptions, setDisruptions] = useState<ServiceDisruption[]>([]);
  const [activeLocations, setActiveLocations] = useState<(GPSLocation & { bus?: Bus; routeName?: string })[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('trip-101-morning');
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<string>('');

  const loadTrackingData = async () => {
    try {
      setRefreshing(true);
      const [routesRes, stopsRes, tripsRes, disruptRes] = await Promise.all([
        fetch('/api/routes'),
        fetch('/api/stops'),
        fetch('/api/trips'),
        fetch('/api/disruptions'),
      ]);

      const routesData = await routesRes.json();
      const stopsData = await stopsRes.json();
      const tripsData = await tripsRes.json();
      const disruptData = await disruptRes.json();

      setRoutes(routesData.routes || []);
      setStops(stopsData.stops || []);
      setTrips(tripsData.trips || []);
      setDisruptions(disruptData.disruptions || []);

      // Fetch live locations for active trips
      const locPromises = (tripsData.trips || [])
        .filter((t: Trip) => t.status === 'in_progress' || t.status === 'scheduled')
        .map(async (t: Trip) => {
          const res = await fetch(`/api/trips/${t.id}/location`);
          const data = await res.json();
          if (data.location) {
            return {
              ...data.location,
              bus: t.bus,
              routeName: t.route?.routeName,
            };
          }
          return null;
        });

      const fetchedLocs = (await Promise.all(locPromises)).filter(Boolean) as (GPSLocation & { bus?: Bus; routeName?: string })[];
      setActiveLocations(fetchedLocs);
      setLastFetchTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
    } catch (err) {
      console.error('Failed to refresh GPS telemetry', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTrackingData();
    // Auto-refresh every 15 seconds for live telemetry
    const interval = setInterval(loadTrackingData, 15000);
    return () => clearInterval(interval);
  }, []);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || trips[0];
  const selectedLocation = activeLocations.find((l) => l.tripId === selectedTripId);

  return (
    <div style={{ padding: '48px 0', minHeight: '80vh' }}>
      <div className="container">
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: 'var(--color-primary)',
                marginBottom: '6px',
              }}
            >
              <span className="live-pulse"></span>
              Live Satellite & Telemetry Feed
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '8px' }}>
              Real-Time Fleet GPS Tracking
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '720px', margin: 0 }}>
              Live location coordinates transmitted from active driver mobile units and on-board telemetry devices.
              Buses without updates for &gt; 2 minutes are explicitly labeled as stale.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lastFetchTime && (
              <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                Updated at {lastFetchTime} IST
              </span>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadTrackingData}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Pinging Fleet...' : 'Refresh GPS'}
            </button>
          </div>
        </div>

        {/* 2-Column: Active Trip Selector / Telemetry Card + Live Map */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '32px',
            alignItems: 'start',
          }}
        >
          {/* Left Column: Active Trips & Telemetry */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Telemetry Summary Card */}
            {selectedTrip && (
              <div
                className="card-dark"
                style={{
                  backgroundColor: 'var(--color-surface-dark)',
                  color: '#ffffff',
                  padding: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        color: '#ffffff',
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: 800,
                      }}
                    >
                      TRIP {selectedTrip.route?.routeNumber}
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 700 }}>
                      {selectedTrip.route?.routeName}
                    </span>
                  </div>

                  {selectedLocation?.isLive ? (
                    <span className="badge badge-success" style={{ fontSize: '11px' }}>
                      ● LIVE BROADCAST
                    </span>
                  ) : (
                    <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                      STALE SIGNAL (&gt;2 MIN)
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    backgroundColor: 'var(--color-surface-dark-elevated)',
                    padding: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-on-dark-soft)', letterSpacing: '1px' }}>
                      Assigned Bus
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                      {selectedTrip.bus?.busCode || 'BUS'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#93c5fd' }}>
                      {selectedTrip.bus?.registrationNumber || 'AP Registered'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-on-dark-soft)', letterSpacing: '1px' }}>
                      Ground Speed
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                      {selectedLocation ? `${selectedLocation.speedKmH} km/h` : '0 km/h'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-on-dark-soft)' }}>
                      Heading: {selectedLocation?.heading || 0}°
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-on-dark-soft)', letterSpacing: '1px' }}>
                      Driver Assigned
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                      {selectedTrip.driver?.fullName || 'Crew Assigned'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-on-dark-soft)' }}>
                      {selectedTrip.driver?.phone || 'On Duty'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--color-on-dark-soft)', lineHeight: 1.6 }}>
                  <strong>Operational Notes:</strong> {selectedTrip.operationalNotes || 'Standard scheduled service.'}
                </div>
              </div>
            )}

            {/* List of Active & Operating Services */}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
                Active Operating Services ({trips.length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {trips.map((trip) => {
                  const isSelected = selectedTrip?.id === trip.id;
                  const loc = activeLocations.find((l) => l.tripId === trip.id);

                  return (
                    <div
                      key={trip.id}
                      className="card"
                      onClick={() => setSelectedTripId(trip.id)}
                      style={{
                        cursor: 'pointer',
                        padding: '16px',
                        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
                        backgroundColor: isSelected ? 'var(--color-surface-card)' : '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              backgroundColor: 'var(--color-primary)',
                              color: '#ffffff',
                              padding: '2px 8px',
                              fontWeight: 800,
                              fontSize: '11px',
                            }}
                          >
                            R-{trip.route?.routeNumber}
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 700 }}>
                            {trip.route?.routeName}
                          </span>
                        </div>

                        {loc?.isLive ? (
                          <span className="badge badge-success" style={{ fontSize: '10px' }}>
                            Live GPS
                          </span>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                            {trip.status}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          color: 'var(--color-muted)',
                        }}
                      >
                        <div>
                          <strong>Dep:</strong> {trip.departureTime} • <strong>Bus:</strong> {trip.bus?.busCode} ({trip.bus?.registrationNumber})
                        </div>
                        <div>
                          {trip.bookedSeats} / {trip.totalSeats} seats booked
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Live Map */}
          <div style={{ position: 'sticky', top: '80px' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '16px 20px',
                  backgroundColor: 'var(--color-surface-dark)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#93c5fd' }}>
                    Live GPS Telemetry Visualizer
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>
                    Amaravati • Vijayawada • Guntur Corridors
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <span className="live-pulse"></span>
                  <span>Auto-Pinging Active</span>
                </div>
              </div>

              <TransitMap
                stops={stops}
                routes={routes}
                selectedRouteId={selectedTrip?.routeId}
                activeLocations={activeLocations}
                height="560px"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
