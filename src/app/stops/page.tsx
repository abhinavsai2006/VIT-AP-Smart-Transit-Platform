'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Stop, Route } from '@/types/transit';
import { MapPin, Search, Bus, CheckCircle2, Navigation, Compass } from 'lucide-react';
import TransitMap from '@/components/map/TransitMap';

export default function StopsPage() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [stopsRes, routesRes] = await Promise.all([
          fetch('/api/stops'),
          fetch('/api/routes'),
        ]);
        const stopsData = await stopsRes.json();
        const routesData = await routesRes.json();
        setStops(stopsData.stops || []);
        setRoutes(routesData.routes || []);
        if (stopsData.stops && stopsData.stops.length > 0) {
          setSelectedStopId(stopsData.stops[0].id);
        }
      } catch (err) {
        console.error('Failed to load stops', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredStops = stops.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.landmark.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedStop = stops.find((s) => s.id === selectedStopId) || stops[0];

  // Find routes that stop at this selected stop
  const servicingRoutes = routes.filter((r) =>
    r.stops.some((rs) => rs.stopId === selectedStop?.id)
  );

  return (
    <div style={{ padding: '48px 0', minHeight: '80vh' }}>
      <div className="container">
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
            Campus Infrastructure
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '8px' }}>
            Bus Stop Directory & Landmarks
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '720px', margin: 0 }}>
            Official pickup shelters, interchange hubs, and campus bay coordinates with accessibility parameters.
          </p>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '28px', maxWidth: '540px' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-muted)',
              }}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Search stop by code, name, or landmark..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '44px' }}
            />
          </div>
        </div>

        {/* 2-Column Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '32px',
            alignItems: 'start',
          }}
        >
          {/* Stops List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredStops.map((stop) => {
              const isSelected = selectedStop?.id === stop.id;
              const routesCount = routes.filter((r) =>
                r.stops.some((rs) => rs.stopId === stop.id)
              ).length;

              return (
                <div
                  key={stop.id}
                  className="card"
                  onClick={() => setSelectedStopId(stop.id)}
                  style={{
                    cursor: 'pointer',
                    border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
                    backgroundColor: isSelected ? 'var(--color-surface-card)' : '#ffffff',
                    transition: 'all 0.15s ease',
                    padding: '24px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--color-primary)',
                        backgroundColor: 'var(--color-surface-soft)',
                        padding: '3px 8px',
                        border: '1px solid var(--color-hairline-strong)',
                      }}
                    >
                      {stop.code}
                    </span>
                    {stop.isAccessible ? (
                      <span className="badge badge-success" style={{ fontSize: '10px' }}>
                        ♿ Accessible
                      </span>
                    ) : (
                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                        Standard Access
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>
                    {stop.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--color-body)', marginBottom: '14px' }}>
                    {stop.description}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--color-hairline)',
                      paddingTop: '12px',
                      fontSize: '12px',
                      color: 'var(--color-muted)',
                    }}
                  >
                    <div>
                      <strong>Landmark:</strong> {stop.landmark}
                    </div>
                    <div>
                      <strong>{routesCount}</strong> {routesCount === 1 ? 'Route' : 'Routes'} Servicing
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stop Details & Map */}
          <div style={{ position: 'sticky', top: '80px' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '20px',
                  backgroundColor: 'var(--color-surface-dark)',
                  color: '#ffffff',
                }}
              >
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#93c5fd' }}>
                  Stop Details & Coordinates
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
                  {selectedStop?.name}
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--color-on-dark-soft)', marginTop: '4px' }}>
                  {selectedStop && Number.isFinite(selectedStop.latitude) && Number.isFinite(selectedStop.longitude)
                    ? <>Coordinates: {selectedStop.latitude.toFixed(5)}° N, {selectedStop.longitude.toFixed(5)}° E{selectedStop.coordinateStatus === 'geocoded_unverified' ? ' (approximate, unverified)' : ''}</>
                    : 'Location not yet verified'}
                </div>
              </div>

              {!loading && (
                <TransitMap
                  stops={stops}
                  routes={routes}
                  selectedStopId={selectedStop?.id}
                  center={selectedStop && Number.isFinite(selectedStop.latitude) ? [selectedStop.latitude, selectedStop.longitude] : undefined}
                  zoom={14}
                  height="340px"
                />
              )}

              {/* Servicing Routes Table */}
              <div style={{ padding: '20px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                  Buses & Corridors Stopping Here ({servicingRoutes.length})
                </h4>
                {servicingRoutes.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                    No scheduled routes stopping at this location currently.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {servicingRoutes.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          padding: '12px 14px',
                          border: '1px solid var(--color-hairline)',
                          backgroundColor: 'var(--color-surface-card)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
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
                            R-{r.routeNumber}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 700 }}>
                            {r.routeName}
                          </span>
                        </div>
                        <Link
                          href={`/booking?originStopId=${selectedStop?.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                        >
                          Book from here ›
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
