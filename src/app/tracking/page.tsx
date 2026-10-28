'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Route, Stop, Trip, GPSLocation, Bus } from '@/types/transit';
import TransitMap from '@/components/map/TransitMap';
import { createClient } from '@/lib/supabase/client';
import {
  RefreshCw,
  MapPin,
  Crosshair,
  Maximize2,
  Radio,
  Clock,
  Compass,
} from 'lucide-react';

function computeScheduledTime(baseTime: string | undefined, offsetMinutes: number = 0): string {
  if (!baseTime) return '--:--';
  const parts = baseTime.split(':');
  if (parts.length < 2) return baseTime;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return baseTime;

  const totalMinutes = hours * 60 + minutes + offsetMinutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  const period = newHours >= 12 ? 'PM' : 'AM';
  const displayHours = newHours % 12 === 0 ? 12 : newHours % 12;
  const displayMins = newMins.toString().padStart(2, '0');
  return `${displayHours}:${displayMins} ${period}`;
}

export default function TrackingPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeLocations, setActiveLocations] = useState<(GPSLocation & { bus?: Bus; routeName?: string })[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('trip-101-morning');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<string>('');

  const loadTrackingData = async () => {
    try {
      setRefreshing(true);
      const [routesRes, stopsRes, tripsRes] = await Promise.all([
        fetch('/api/routes'),
        fetch('/api/stops'),
        fetch('/api/trips'),
      ]);

      const routesData = await routesRes.json();
      const stopsData = await stopsRes.json();
      const tripsData = await tripsRes.json();

      setRoutes(routesData.routes || []);
      setStops(stopsData.stops || []);
      setTrips(tripsData.trips || []);

      // Fetch live locations for all active trips
      const locPromises = (tripsData.trips || [])
        .filter((t: Trip) => t.status === 'in_progress' || t.status === 'scheduled')
        .map(async (t: Trip) => {
          try {
            const res = await fetch(`/api/trips/${t.id}/location`);
            const data = await res.json();
            if (data.location) {
              return {
                ...data.location,
                bus: t.bus,
                routeName: t.route?.routeName,
              };
            }
          } catch {
            // Ignore telemetry fetch race
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

    // 3.5s real-time polling cadence for smooth continuous vehicle tracking
    const interval = setInterval(loadTrackingData, 3500);

    // Optional Supabase Realtime subscription when live cloud credentials exist
    const supabase = createClient();
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    if (supabase) {
      channel = supabase
        .channel('realtime:gps_locations')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'gps_locations' },
          () => {
            loadTrackingData();
          }
        )
        .subscribe();
    }

    return () => {
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const selectedTrip = useMemo(() => {
    return trips.find((t) => t.id === selectedTripId) || trips[0];
  }, [trips, selectedTripId]);

  const selectedLocation = useMemo(() => {
    return activeLocations.find((l) => l.tripId === selectedTripId);
  }, [activeLocations, selectedTripId]);

  const selectedRouteStops = useMemo(() => {
    if (!selectedTrip?.route?.stops) return [];
    return [...selectedTrip.route.stops].sort((a, b) => a.stopSequence - b.stopSequence);
  }, [selectedTrip]);

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
              Live Fleet Telemetry & Satellite Feed
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '8px' }}>
              Real-Time Fleet GPS Tracking
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '720px', margin: 0 }}>
              Live telemetry ingested from driver mobile units and on-board hardware. The map automatically follows your selected bus as it travels along the corridor.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lastFetchTime && (
              <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                Pinged at {lastFetchTime} IST
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

                  {selectedLocation ? (
                    selectedLocation.isLive ? (
                      <span className="badge badge-success" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span className="live-pulse" style={{ width: '6px', height: '6px' }}></span>
                        LIVE BROADCAST
                      </span>
                    ) : (
                      <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                        STALE SIGNAL (&gt;2 MIN)
                      </span>
                    )
                  ) : (
                    <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                      AWAITING DRIVER GPS
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

                {selectedLocation && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-on-dark-soft)',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #334155',
                      paddingBottom: '10px',
                    }}
                  >
                    <span>
                      GPS Fix: <strong>{selectedLocation.latitude.toFixed(4)}° N, {selectedLocation.longitude.toFixed(4)}° E</strong>
                    </span>
                    <span>
                      Updated: {new Date(selectedLocation.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                    </span>
                  </div>
                )}

                <div style={{ fontSize: '12px', color: 'var(--color-on-dark-soft)', lineHeight: 1.6, marginBottom: '16px' }}>
                  <strong>Operational Notes:</strong> {selectedTrip.operationalNotes || 'Standard scheduled institutional transit service.'}
                </div>

                {/* Ordered Route Stops Breakdown */}
                {selectedRouteStops.length > 0 && (
                  <div style={{ borderTop: '1px solid #334155', paddingTop: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8', marginBottom: '8px' }}>
                      Corridor Stops & Scheduled Times ({selectedRouteStops.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {selectedRouteStops.map((rs) => {
                        const s = rs.stop || stops.find((item) => item.id === rs.stopId);
                        if (!s) return null;
                        const isStopActive = selectedStopId === s.id;
                        const stopTime = computeScheduledTime(selectedTrip.departureTime, rs.arrivalOffsetMinutes);

                        return (
                          <div
                            key={rs.id}
                            onClick={() => setSelectedStopId(s.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              backgroundColor: isStopActive ? '#1e293b' : 'rgba(255,255,255,0.04)',
                              border: isStopActive ? '1px solid #3b82f6' : '1px solid transparent',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '10px', color: '#94a3b8', width: '20px' }}>#{rs.stopSequence}</span>
                              <span style={{ fontWeight: isStopActive ? 800 : 600 }}>{s.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 700 }}>{stopTime}</span>
                              <MapPin size={12} color={isStopActive ? '#60a5fa' : '#64748b'} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                      onClick={() => {
                        setSelectedTripId(trip.id);
                        setSelectedStopId(null);
                      }}
                      style={{
                        cursor: 'pointer',
                        padding: '16px',
                        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
                        backgroundColor: isSelected ? '#f8fafd' : '#ffffff',
                        boxShadow: isSelected ? '0 4px 12px rgba(28, 105, 212, 0.16)' : 'none',
                        transition: 'all 0.2s ease',
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isSelected && (
                            <span
                              style={{
                                backgroundColor: '#dbeafe',
                                color: '#1e40af',
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 6px',
                              }}
                            >
                              ● ACTIVE FOCUS
                            </span>
                          )}
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
                  <span>Auto-Pinging Active (3.5s)</span>
                </div>
              </div>

              <TransitMap
                stops={stops}
                routes={routes}
                selectedRouteId={selectedTrip?.routeId}
                selectedTripId={selectedTrip?.id}
                selectedStopId={selectedStopId || undefined}
                activeLocations={activeLocations}
                height="560px"
                onSelectTrip={(tripId) => {
                  setSelectedTripId(tripId);
                  setSelectedStopId(null);
                }}
                onSelectStop={(stopId) => {
                  setSelectedStopId(stopId);
                }}
                onSelectRoute={(routeId) => {
                  const trip = trips.find((t) => t.routeId === routeId);
                  if (trip) {
                    setSelectedTripId(trip.id);
                    setSelectedStopId(null);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
