'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Route, Stop } from '@/types/transit';
import TransitMap from '@/components/map/TransitMap';
import { Bus, MapPin, Clock, ArrowRight, ShieldCheck, Search, Filter } from 'lucide-react';

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [routesRes, stopsRes] = await Promise.all([
          fetch('/api/routes'),
          fetch('/api/stops'),
        ]);
        const routesData = await routesRes.json();
        const stopsData = await stopsRes.json();
        setRoutes(routesData.routes || []);
        setStops(stopsData.stops || []);
        if (routesData.routes && routesData.routes.length > 0) {
          setSelectedRouteId(routesData.routes[0].id);
        }
      } catch (err) {
        console.error('Failed to load routes', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredRoutes = routes.filter(
    (r) =>
      r.routeNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.routeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];

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
            Network Timetable
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 700, marginBottom: '8px' }}>
            Campus Routes & Stop Sequences
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--color-muted)', maxWidth: '720px', margin: 0 }}>
            Official 2026-27 morning timetable: 44 routes from Vijayawada, Guntur and Tenali, all arriving at VIT-AP Campus by 8:45 AM.
          </p>
        </div>

        {/* Search Bar */}
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
              placeholder="Search by route number, destination, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '44px' }}
            />
          </div>
        </div>

        {/* Layout: Route Cards List + Interactive Map Preview */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '32px',
            alignItems: 'start',
          }}
        >
          {/* Routes List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredRoutes.map((route) => {
              const isSelected = selectedRoute?.id === route.id;
              const sortedStops = [...route.stops].sort((a, b) => a.stopSequence - b.stopSequence);

              return (
                <div
                  key={route.id}
                  className="card"
                  onClick={() => setSelectedRouteId(route.id)}
                  style={{
                    cursor: 'pointer',
                    border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
                    backgroundColor: isSelected ? 'var(--color-surface-card)' : '#ffffff',
                    transition: 'all 0.15s ease',
                    padding: '24px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-surface-dark)',
                          color: '#ffffff',
                          padding: '4px 10px',
                          fontWeight: 700,
                          fontSize: '13px',
                        }}
                      >
                        ROUTE {route.routeNumber}
                      </div>
                      <span className="badge badge-success" style={{ fontSize: '10px' }}>
                        {route.status.toUpperCase()}
                      </span>
                    </div>

                    {route.fareAmount > 0 && (
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-ink)' }}>
                        ₹{route.fareAmount}
                      </div>
                    )}
                  </div>

                  <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>
                    {route.routeName}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--color-body)', marginBottom: '16px' }}>
                    {route.description}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      fontSize: '12px',
                      color: 'var(--color-muted)',
                      borderTop: '1px solid var(--color-hairline)',
                      paddingTop: '12px',
                    }}
                  >
                    {route.distanceKm > 0 && (
                      <>
                        <span>
                          <strong>Distance:</strong> {route.distanceKm} km
                        </span>
                        <span>•</span>
                      </>
                    )}
                    <span>
                      <strong>{route.source ? 'Scheduled' : 'Est. Travel'}:</strong> {route.estimatedDurationMinutes} mins
                    </span>
                    <span>•</span>
                    <span>
                      <strong>Stops:</strong> {route.stops.length}
                    </span>
                  </div>

                  {/* Stop sequence tags */}
                  <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {sortedStops.map((rs, idx) => (
                      <span
                        key={rs.id}
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          backgroundColor: 'var(--color-surface-soft)',
                          border: '1px solid var(--color-hairline-strong)',
                          color: 'var(--color-ink)',
                        }}
                      >
                        {idx + 1}. {rs.stop?.name || rs.stopId}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Map Preview for Selected Route */}
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
                    Selected Corridor Map
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>
                    Route {selectedRoute?.routeNumber}: {selectedRoute?.routeName}
                  </div>
                </div>
                <Link
                  href={`/tracking?routeId=${selectedRoute?.id}`}
                  className="btn btn-outline-dark btn-sm"
                  style={{ fontSize: '12px' }}
                >
                  Live GPS Track ›
                </Link>
              </div>

              {!loading && (
                <TransitMap
                  stops={stops}
                  routes={routes}
                  selectedRouteId={selectedRoute?.id}
                  height="460px"
                />
              )}

              {/* Stop Sequence Detail Table */}
              <div style={{ padding: '20px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                  Ordered Stop Sequence & Timing Offsets
                </h4>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Stop Name</th>
                        <th>Scheduled Time</th>
                        <th>Offset</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRoute?.stops
                        .sort((a, b) => a.stopSequence - b.stopSequence)
                        .map((rs) => (
                          <tr key={rs.id}>
                            <td style={{ fontWeight: 700 }}>{rs.stopSequence}</td>
                            <td>{rs.stop?.name || rs.stopId}</td>
                            <td style={{ fontWeight: 700 }}>{rs.scheduledTime || '—'}</td>
                            <td>+{rs.arrivalOffsetMinutes} mins</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
