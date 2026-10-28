'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Route, Stop, GPSLocation, Bus } from '@/types/transit';
import { MapPin, Bus as BusIcon, Radio, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

interface TransitMapProps {
  stops?: Stop[];
  routes?: Route[];
  selectedRouteId?: string;
  activeLocations?: (GPSLocation & { bus?: Bus; routeName?: string })[];
  height?: string;
  center?: [number, number]; // [lat, lng]
  zoom?: number;
}

export default function TransitMap({
  stops = [],
  routes = [],
  selectedRouteId,
  activeLocations = [],
  height = '480px',
  center = [16.4850, 80.5200], // Default center around VIT-AP / Amaravati Region
  zoom = 12,
}: TransitMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'accessible-list'>('map');
  const [selectedItem, setSelectedItem] = useState<{
    type: 'bus' | 'stop';
    title: string;
    details: string;
    status: string;
    speed?: number;
    lastUpdated?: string;
  } | null>(null);

  useEffect(() => {
    // Only execute on browser client
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    // Dynamically load Leaflet
    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Clean up previous instance if re-rendering
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }

      // Initialize map instance
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      // Clean CartoDB Positron / OSM tiles for high-contrast corporate aesthetic
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Custom Stop Pin Icon
      const createStopIcon = (code: string) =>
        L.divIcon({
          className: 'custom-stop-marker',
          html: `
            <div style="
              background-color: #1a2129;
              color: #ffffff;
              width: 24px;
              height: 24px;
              border-radius: 0px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: 700;
              border: 1px solid #ffffff;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            ">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 24],
          popupAnchor: [0, -24],
        });

      // Custom Bus Icon
      const createBusIcon = (isLive: boolean, busCode: string) =>
        L.divIcon({
          className: 'custom-bus-marker',
          html: `
            <div style="
              background-color: ${isLive ? '#1c69d4' : '#6b6b6b'};
              color: #ffffff;
              padding: 4px 8px;
              border-radius: 0px;
              display: flex;
              align-items: center;
              gap: 4px;
              font-size: 11px;
              font-weight: 700;
              box-shadow: 0 4px 10px rgba(0,0,0,0.35);
              border: 2px solid #ffffff;
              white-space: nowrap;
            ">
              <span style="
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: ${isLive ? '#22c55e' : '#f59e0b'};
                display: inline-block;
              "></span>
              <span>${busCode}</span>
            </div>
          `,
          iconSize: [60, 26],
          iconAnchor: [30, 13],
          popupAnchor: [0, -15],
        });

      // Add Stops to Map
      stops.forEach((stop) => {
        const marker = L.marker([stop.latitude, stop.longitude], {
          icon: createStopIcon(stop.code),
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; min-width: 180px;">
            <div style="font-size: 10px; font-weight: 700; color: #1c69d4; text-transform: uppercase;">Bus Stop</div>
            <div style="font-size: 14px; font-weight: 700; margin: 2px 0;">${stop.name}</div>
            <div style="font-size: 12px; color: #6b6b6b; margin-bottom: 6px;">${stop.description}</div>
            <div style="font-size: 11px; color: #1a1a1a;"><strong>Landmark:</strong> ${stop.landmark}</div>
            <div style="font-size: 11px; margin-top: 4px; color: ${stop.isAccessible ? '#065f46' : '#6b6b6b'};">
              ${stop.isAccessible ? '♿ Wheelchair Accessible' : 'Standard Access'}
            </div>
          </div>
        `);

        marker.on('click', () => {
          setSelectedItem({
            type: 'stop',
            title: stop.name,
            details: `${stop.description} (${stop.landmark})`,
            status: stop.isAccessible ? 'Accessible Stop' : 'Active Stop',
          });
        });
      });

      // Draw Route Polylines
      const routesToDraw = selectedRouteId
        ? routes.filter((r) => r.id === selectedRouteId)
        : routes;

      routesToDraw.forEach((route) => {
        // Collect coordinates from ordered route.stops
        const sorted = [...route.stops].sort((a, b) => a.stopSequence - b.stopSequence);
        const polylineCoords: [number, number][] = [];

        sorted.forEach((rs) => {
          const s = rs.stop || stops.find((x) => x.id === rs.stopId);
          if (s) {
            polylineCoords.push([s.latitude, s.longitude]);
          }
        });

        if (polylineCoords.length >= 2) {
          const polyline = L.polyline(polylineCoords, {
            color: selectedRouteId === route.id ? '#1c69d4' : '#6b6b6b',
            weight: selectedRouteId === route.id ? 5 : 3,
            opacity: 0.85,
            dashArray: selectedRouteId === route.id ? undefined : '5, 8',
          }).addTo(map);

          polyline.bindPopup(`
            <div style="font-family: system-ui, sans-serif;">
              <strong>Route ${route.routeNumber}:</strong> ${route.routeName}<br/>
              <span style="font-size: 12px; color: #6b6b6b;">Duration: ~${route.estimatedDurationMinutes} mins | ${route.distanceKm} km</span>
            </div>
          `);
        }
      });

      // Add Active Bus GPS Locations
      activeLocations.forEach((loc) => {
        const busCode = loc.bus?.busCode || 'BUS';
        const marker = L.marker([loc.latitude, loc.longitude], {
          icon: createBusIcon(loc.isLive, busCode),
          zIndexOffset: 1000,
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; min-width: 200px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 11px; font-weight: 700; color: #1c69d4;">VEHICLE LOCATION</span>
              <span style="font-size: 10px; padding: 2px 6px; font-weight: 700; background: ${loc.isLive ? '#ecfdf5' : '#fffbeb'}; color: ${loc.isLive ? '#065f46' : '#92400e'};">
                ${loc.isLive ? 'LIVE' : 'STALE (2+ min)'}
              </span>
            </div>
            <div style="font-size: 15px; font-weight: 700;">${loc.bus?.busCode || 'Campus Bus'} (${loc.bus?.registrationNumber || ''})</div>
            <div style="font-size: 12px; color: #3c3c3c; margin: 4px 0;">
              <strong>Speed:</strong> ${loc.speedKmH} km/h | <strong>Heading:</strong> ${loc.heading}°
            </div>
            <div style="font-size: 11px; color: #6b6b6b;">
              Last Ping: ${new Date(loc.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
            </div>
          </div>
        `);

        marker.on('click', () => {
          setSelectedItem({
            type: 'bus',
            title: `${loc.bus?.busCode || 'Bus'} (${loc.bus?.registrationNumber || 'AP Reg'})`,
            details: `${loc.bus?.vehicleType || 'Express Service'} - Route: ${loc.routeName || 'Assigned Trip'}`,
            status: loc.isLive ? 'Live GPS Tracking Active' : 'Stale GPS / Signal Weak',
            speed: loc.speedKmH,
            lastUpdated: new Date(loc.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
          });
        });
      });
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
  }, [stops, routes, selectedRouteId, activeLocations, center, zoom]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Map Control Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'map' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('map')}
            >
              Interactive Map
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'accessible-list' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('accessible-list')}
            >
              Accessible List View
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-muted)' }}>
            <span className="live-pulse"></span>
            <span>{activeLocations.filter((l) => l.isLive).length} Buses Broadcasting GPS</span>
          </div>
        </div>

        {selectedItem && (
          <div
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline-strong)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <strong>{selectedItem.title}</strong>
            <span>•</span>
            <span style={{ color: 'var(--color-primary)' }}>{selectedItem.status}</span>
            {selectedItem.speed !== undefined && (
              <span>({selectedItem.speed} km/h)</span>
            )}
          </div>
        )}
      </div>

      {/* Main View Container */}
      {activeTab === 'map' ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height,
            border: '1px solid var(--color-hairline-strong)',
            backgroundColor: 'var(--color-surface-soft)',
          }}
        >
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

          {/* Map Legend Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid var(--color-hairline-strong)',
              padding: '10px 14px',
              zIndex: 1000,
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Map Legend</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 10, height: 10, backgroundColor: '#1c69d4', display: 'inline-block' }}></span>
              <span>Live Active Bus</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 10, height: 10, backgroundColor: '#6b6b6b', display: 'inline-block' }}></span>
              <span>Stale Bus (No Signal &gt;2m)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 10, height: 10, backgroundColor: '#1a2129', display: 'inline-block' }}></span>
              <span>Campus Bus Stop</span>
            </div>
          </div>
        </div>
      ) : (
        /* Accessible List & Table View */
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-hairline)', backgroundColor: 'var(--color-surface-soft)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Active Fleet & Stop Accessibility Directory</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: 0 }}>
              Text-accessible breakdown of real-time bus locations and stop arrival sequences.
            </p>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Real-time GPS Vehicles</h4>
            <div className="table-container" style={{ marginBottom: '24px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bus Code</th>
                    <th>AP Registration</th>
                    <th>Current Status</th>
                    <th>Speed</th>
                    <th>Coordinates</th>
                    <th>Last Update</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLocations.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted)' }}>
                        No vehicles currently broadcasting live location data.
                      </td>
                    </tr>
                  ) : (
                    activeLocations.map((loc) => (
                      <tr key={loc.id}>
                        <td style={{ fontWeight: 700 }}>{loc.bus?.busCode || 'BUS'}</td>
                        <td>{loc.bus?.registrationNumber || 'AP39...'}</td>
                        <td>
                          {loc.isLive ? (
                            <span className="badge badge-success">Live (Active)</span>
                          ) : (
                            <span className="badge badge-warning">Stale (Signal Weak)</span>
                          )}
                        </td>
                        <td>{loc.speedKmH} km/h</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                          {loc.latitude.toFixed(4)}° N, {loc.longitude.toFixed(4)}° E
                        </td>
                        <td>
                          {new Date(loc.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Configured Bus Stops</h4>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Stop Name</th>
                    <th>Landmark / Location</th>
                    <th>Accessibility</th>
                    <th>GPS Coordinates</th>
                  </tr>
                </thead>
                <tbody>
                  {stops.map((stop) => (
                    <tr key={stop.id}>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{stop.code}</td>
                      <td>{stop.name}</td>
                      <td>{stop.description} ({stop.landmark})</td>
                      <td>
                        {stop.isAccessible ? (
                          <span className="badge badge-success">♿ Wheelchair Accessible</span>
                        ) : (
                          <span className="badge badge-neutral">Standard</span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
