'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Route, Stop, GPSLocation, Bus } from '@/types/transit';
import { MapPin, Bus as BusIcon, Radio, Clock, AlertTriangle, ShieldCheck, Compass, Layers } from 'lucide-react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

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
  center = [16.4950, 80.5005], // Default centered on VIT-AP Central Campus
  zoom = 12,
}: TransitMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'accessible-list'>('map');
  const [mapProvider, setMapProvider] = useState<'google' | 'leaflet'>('leaflet');
  const [googleLoadError, setGoogleLoadError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<{
    type: 'bus' | 'stop';
    title: string;
    details: string;
    status: string;
    speed?: number;
    lastUpdated?: string;
  } | null>(null);

  // References to track map instances and clean them up
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const leafletMapRef = useRef<unknown>(null);
  const googleMarkersRef = useRef<google.maps.Marker[]>([]);
  const googlePolylinesRef = useRef<google.maps.Polyline[]>([]);

  // Cleanup helper
  const cleanupMaps = useCallback(() => {
    // Cleanup Google Maps markers & polylines
    googleMarkersRef.current.forEach((m) => m.setMap(null));
    googleMarkersRef.current = [];
    googlePolylinesRef.current.forEach((p) => p.setMap(null));
    googlePolylinesRef.current = [];
    googleMapRef.current = null;

    // Cleanup Leaflet
    if (leafletMapRef.current) {
      try {
        (leafletMapRef.current as { remove: () => void }).remove();
      } catch {
        // Ignore Leaflet unmount race
      }
      leafletMapRef.current = null;
    }
  }, []);

  // Initialize Leaflet Map
  const initLeafletMap = useCallback(async () => {
    if (!mapContainerRef.current) return;
    cleanupMaps();

    const L = (await import('leaflet')).default;
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: true,
    });
    leafletMapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

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

    // Render Stops
    stops.forEach((stop) => {
      const marker = L.marker([stop.latitude, stop.longitude], {
        icon: createStopIcon(stop.code),
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; min-width: 180px;">
          <div style="font-size: 10px; font-weight: 700; color: #1c69d4; text-transform: uppercase;">Bus Stop</div>
          <div style="font-size: 14px; font-weight: 700; margin: 2px 0;">${stop.name}</div>
          <div style="font-size: 12px; color: #6b6b6b; margin-bottom: 6px;">${stop.description}</div>
          <div style="font-size: 11px; font-weight: 700; color: #1a2129;">Code: ${stop.code}</div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedItem({
          type: 'stop',
          title: stop.name,
          details: `${stop.description} (${stop.landmark})`,
          status: stop.isAccessible ? 'Wheelchair Accessible' : 'Standard Stop',
        });
      });
    });

    // Render Routes Polylines
    routes.forEach((route) => {
      const isSelected = selectedRouteId === route.id;
      const sortedStops = [...route.stops].sort((a, b) => a.stopSequence - b.stopSequence);
      const latLngs = sortedStops
        .map((rs) => {
          const s = rs.stop || stops.find((st) => st.id === rs.stopId);
          return s ? [s.latitude, s.longitude] as [number, number] : null;
        })
        .filter(Boolean) as [number, number][];

      if (latLngs.length > 1) {
        L.polyline(latLngs, {
          color: isSelected ? '#1c69d4' : '#94a3b8',
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 0.9 : 0.6,
          dashArray: isSelected ? undefined : '5, 8',
        }).addTo(map);
      }
    });

    // Render Live Vehicles
    activeLocations.forEach((loc) => {
      const busCode = loc.bus?.busCode || 'BUS';
      const marker = L.marker([loc.latitude, loc.longitude], {
        icon: createBusIcon(loc.isLive, busCode),
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; min-width: 200px;">
          <div style="font-size: 10px; font-weight: 700; color: #1c69d4; text-transform: uppercase;">Vehicle Telemetry</div>
          <div style="font-size: 15px; font-weight: 800; margin: 2px 0;">${busCode} (${loc.bus?.rawRegistration || loc.bus?.registrationNumber || 'AP39'})</div>
          <div style="font-size: 12px; margin-bottom: 6px;">Speed: <strong>${loc.speedKmH} km/h</strong></div>
          <div style="font-size: 11px; color: #6b6b6b;">Status: <strong>${loc.isLive ? 'Live GPS Feed' : 'Stale Location (>2m)'}</strong></div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedItem({
          type: 'bus',
          title: `Vehicle ${busCode}`,
          details: `Route: ${loc.routeName || 'Scheduled Commuter'} | Speed: ${loc.speedKmH} km/h`,
          status: loc.isLive ? 'Active Telemetry' : 'Signal Stale',
          speed: loc.speedKmH,
          lastUpdated: new Date(loc.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        });
      });
    });

    // Auto-fit selected route if provided
    if (selectedRouteId) {
      const selected = routes.find((r) => r.id === selectedRouteId);
      if (selected && selected.stops.length > 0) {
        const coords = selected.stops
          .map((rs) => rs.stop || stops.find((s) => s.id === rs.stopId))
          .filter(Boolean)
          .map((s) => [s!.latitude, s!.longitude] as [number, number]);
        if (coords.length > 0) {
          map.fitBounds(coords, { padding: [40, 40] });
        }
      }
    }
  }, [stops, routes, selectedRouteId, activeLocations, center, zoom, cleanupMaps]);

  // Initialize Google Maps Map
  const initGoogleMap = useCallback(async (apiKey: string) => {
    if (!mapContainerRef.current) return;
    cleanupMaps();

    setOptions({
      key: apiKey,
      v: 'weekly',
    });

    const { Map } = (await importLibrary('maps')) as google.maps.MapsLibrary;
    if (!mapContainerRef.current) return;

    const map = new Map(mapContainerRef.current, {
      center: { lat: center[0], lng: center[1] },
      zoom,
      mapTypeId: 'roadmap',
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
        { featureType: 'transit.station', stylers: [{ visibility: 'on' }] },
      ],
    });
    googleMapRef.current = map;

    const bounds = new google.maps.LatLngBounds();

    // Render Stops as Custom Markers
    stops.forEach((stop) => {
      const pos = { lat: stop.latitude, lng: stop.longitude };
      bounds.extend(pos);

      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: `${stop.name} (${stop.code})`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#1a2129',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 180px;">
            <div style="font-size: 10px; font-weight: 700; color: #1c69d4; text-transform: uppercase;">Bus Stop</div>
            <div style="font-size: 14px; font-weight: 700; margin: 2px 0;">${stop.name}</div>
            <div style="font-size: 12px; color: #6b6b6b; margin-bottom: 4px;">${stop.description}</div>
            <div style="font-size: 11px; font-weight: 700; color: #1a2129;">Code: ${stop.code}</div>
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
        setSelectedItem({
          type: 'stop',
          title: stop.name,
          details: `${stop.description} (${stop.landmark})`,
          status: stop.isAccessible ? 'Wheelchair Accessible' : 'Standard Stop',
        });
      });

      googleMarkersRef.current.push(marker);
    });

    // Render Route Polylines
    routes.forEach((route) => {
      const isSelected = selectedRouteId === route.id;
      const sortedStops = [...route.stops].sort((a, b) => a.stopSequence - b.stopSequence);
      const path = sortedStops
        .map((rs) => {
          const s = rs.stop || stops.find((st) => st.id === rs.stopId);
          return s ? { lat: s.latitude, lng: s.longitude } : null;
        })
        .filter(Boolean) as google.maps.LatLngLiteral[];

      if (path.length > 1) {
        const polyline = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: isSelected ? '#1c69d4' : '#94a3b8',
          strokeOpacity: isSelected ? 0.9 : 0.6,
          strokeWeight: isSelected ? 5 : 3,
          map,
        });
        googlePolylinesRef.current.push(polyline);
      }
    });

    // Render Live Vehicles
    activeLocations.forEach((loc) => {
      const busPos = { lat: loc.latitude, lng: loc.longitude };
      bounds.extend(busPos);

      const busCode = loc.bus?.busCode || 'BUS';
      const marker = new google.maps.Marker({
        position: busPos,
        map,
        title: `${busCode} (Speed: ${loc.speedKmH} km/h)`,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          rotation: loc.heading || 0,
          fillColor: loc.isLive ? '#1c69d4' : '#6b6b6b',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 180px;">
            <div style="font-size: 10px; font-weight: 700; color: #1c69d4; text-transform: uppercase;">Vehicle Telemetry</div>
            <div style="font-size: 15px; font-weight: 800; margin: 2px 0;">${busCode} (${loc.bus?.rawRegistration || 'AP39'})</div>
            <div style="font-size: 12px; margin-bottom: 4px;">Speed: <strong>${loc.speedKmH} km/h</strong></div>
            <div style="font-size: 11px; color: #6b6b6b;">Status: <strong>${loc.isLive ? 'Live GPS Feed' : 'Stale Location (>2m)'}</strong></div>
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
        setSelectedItem({
          type: 'bus',
          title: `Vehicle ${busCode}`,
          details: `Route: ${loc.routeName || 'Scheduled Commuter'} | Speed: ${loc.speedKmH} km/h`,
          status: loc.isLive ? 'Active Telemetry' : 'Signal Stale',
          speed: loc.speedKmH,
          lastUpdated: new Date(loc.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        });
      });

      googleMarkersRef.current.push(marker);
    });

    // Auto fit
    if (selectedRouteId) {
      const selected = routes.find((r) => r.id === selectedRouteId);
      if (selected && selected.stops.length > 0) {
        const routeBounds = new google.maps.LatLngBounds();
        selected.stops.forEach((rs) => {
          const s = rs.stop || stops.find((st) => st.id === rs.stopId);
          if (s) routeBounds.extend({ lat: s.latitude, lng: s.longitude });
        });
        map.fitBounds(routeBounds, 40);
      }
    }
  }, [stops, routes, selectedRouteId, activeLocations, center, zoom, cleanupMaps]);

  // Main lifecycle: detect configuration and initialize provider
  useEffect(() => {
    const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    let isMounted = true;

    async function loadMapEngine() {
      if (googleApiKey && googleApiKey.trim() !== '') {
        try {
          await initGoogleMap(googleApiKey);
          if (isMounted) {
            setMapProvider('google');
            setGoogleLoadError(null);
          }
          return;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Google Maps failed to initialize';
          console.warn('Google Maps API failed, falling back to OpenStreetMap:', msg);
          if (isMounted) {
            setGoogleLoadError(msg);
          }
        }
      }

      // Fallback to Leaflet
      try {
        await initLeafletMap();
        if (isMounted) {
          setMapProvider('leaflet');
        }
      } catch (err) {
        console.error('Leaflet fallback failed', err);
      }
    }

    if (activeTab === 'map') {
      loadMapEngine();
    }

    return () => {
      isMounted = false;
      cleanupMaps();
    };
  }, [activeTab, initGoogleMap, initLeafletMap, cleanupMaps]);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', backgroundColor: '#ffffff' }}>
      {/* Map Control Bar */}
      <div
        style={{
          padding: '12px 20px',
          backgroundColor: 'var(--color-surface-dark)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--color-hairline)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={18} color="var(--color-primary)" />
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px' }}>
              Corridor Telemetry & Route Map
            </span>
          </div>

          {/* Active Provider Indicator Badge */}
          {mapProvider === 'google' ? (
            <span
              style={{
                backgroundColor: '#166534',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              Google Maps Platform Active
            </span>
          ) : (
            <span
              style={{
                backgroundColor: '#1e293b',
                color: '#93c5fd',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                border: '1px solid #3b82f6',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              OpenStreetMap Engine Active
            </span>
          )}
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setActiveTab('map')}
            className={`btn btn-sm ${activeTab === 'map' ? 'btn-primary' : 'btn-outline-dark'}`}
            style={{ fontSize: '11px', padding: '4px 10px' }}
          >
            Interactive Map
          </button>
          <button
            onClick={() => setActiveTab('accessible-list')}
            className={`btn btn-sm ${activeTab === 'accessible-list' ? 'btn-primary' : 'btn-outline-dark'}`}
            style={{ fontSize: '11px', padding: '4px 10px' }}
          >
            Accessible Table View ({stops.length} Stops)
          </button>
        </div>
      </div>

      {/* Google Maps Configuration Notice if fallback occurred */}
      {googleLoadError && activeTab === 'map' && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#eff6ff',
            borderBottom: '1px solid #bfdbfe',
            fontSize: '11px',
            color: '#1e3a8a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            <strong>Map Provider Note:</strong> Google Maps key is pending activation or restricted; automatically serving high-performance OpenStreetMap / Carto tiles without disruption.
          </span>
          <span style={{ color: '#64748b', fontSize: '10px' }}>Failover Protection Active</span>
        </div>
      )}

      {/* Interactive Map View */}
      {activeTab === 'map' && (
        <div style={{ position: 'relative' }}>
          <div
            ref={mapContainerRef}
            style={{
              width: '100%',
              height,
              backgroundColor: '#f1f5f9',
            }}
          />

          {/* Selected Item Floating Drawer */}
          {selectedItem && (
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '16px',
                right: '16px',
                backgroundColor: '#ffffff',
                border: '2px solid var(--color-ink)',
                padding: '16px 20px',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}
            >
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-primary)', fontWeight: 800 }}>
                  Selected {selectedItem.type.toUpperCase()}
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '2px 0' }}>
                  {selectedItem.title}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--color-body)' }}>
                  {selectedItem.details}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span className="badge badge-neutral">{selectedItem.status}</span>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '11px' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accessible List Table View */}
      {activeTab === 'accessible-list' && (
        <div style={{ maxHeight: height, overflowY: 'auto', padding: '16px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Seq</th>
                <th>Stop Code</th>
                <th>Pickup Location Name</th>
                <th>Landmark / Description</th>
                <th>Coordinates</th>
                <th>Accessibility</th>
              </tr>
            </thead>
            <tbody>
              {stops.map((stop, index) => (
                <tr key={stop.id}>
                  <td><strong>#{index + 1}</strong></td>
                  <td><code style={{ fontSize: '11px', fontWeight: 700 }}>{stop.code}</code></td>
                  <td style={{ fontWeight: 700 }}>{stop.name}</td>
                  <td>{stop.description} ({stop.landmark})</td>
                  <td style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                    {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                  </td>
                  <td>
                    {stop.isAccessible ? (
                      <span className="badge badge-success">Wheelchair Accessible</span>
                    ) : (
                      <span className="badge badge-neutral">Standard</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
