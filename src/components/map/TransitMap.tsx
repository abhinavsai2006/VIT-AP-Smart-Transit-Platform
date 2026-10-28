'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Map as LeafletMap, LayerGroup as LeafletLayerGroup, Marker as LeafletMarker } from 'leaflet';
import { Route, Stop, GPSLocation, Bus } from '@/types/transit';
import { LatLng, cumulativeDistances, distanceAlong, pointAtDistance, splitAtDistance } from '@/lib/route-geometry';
import { Compass, AlertTriangle, Crosshair, Maximize2, Radio, RotateCcw, MapPin, Navigation } from 'lucide-react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

interface TransitMapProps {
  stops?: Stop[];
  routes?: Route[];
  selectedRouteId?: string;
  selectedTripId?: string;
  selectedStopId?: string;
  activeLocations?: (GPSLocation & { bus?: Bus; routeName?: string })[];
  height?: string;
  center?: [number, number]; // [lat, lng]
  zoom?: number;
  onSelectTrip?: (tripId: string) => void;
  onSelectStop?: (stopId: string) => void;
  onSelectRoute?: (routeId: string) => void;
}

interface SelectedItemInfo {
  type: 'bus' | 'stop';
  id?: string;
  title: string;
  details: string;
  status: string;
  speed?: number;
  heading?: number;
  lastUpdated?: string;
  coordinates?: [number, number];
}

function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001)
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function TransitMap({
  stops = [],
  routes = [],
  selectedRouteId,
  selectedTripId,
  selectedStopId,
  activeLocations = [],
  height = '480px',
  center = [16.4950, 80.5005], // VIT-AP Central Campus
  zoom = 13,
  onSelectTrip,
  onSelectStop,
  onSelectRoute,
}: TransitMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'accessible-list'>('map');
  const [mapProvider, setMapProvider] = useState<'google' | 'leaflet'>('leaflet');
  const [googleLoadError, setGoogleLoadError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItemInfo | null>(null);
  const [tableFilterMode, setTableFilterMode] = useState<'selected_route' | 'all'>('selected_route');
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [isAutoFollowing, setIsAutoFollowing] = useState<boolean>(true);

  // Leaflet map and layer group references
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const leafletStopsLayerRef = useRef<LeafletLayerGroup | null>(null);
  const leafletRoutesLayerRef = useRef<LeafletLayerGroup | null>(null);
  const leafletVehiclesLayerRef = useRef<LeafletLayerGroup | null>(null);
  const vehicleMarkersMapRef = useRef<Map<string, LeafletMarker>>(new Map());

  // Google Maps references
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkersRef = useRef<google.maps.Marker[]>([]);
  const googlePolylinesRef = useRef<google.maps.Polyline[]>([]);

  // Lifecycle guards
  // Incremented by every mount effect run; an async init only proceeds if its generation is still current.
  // (A boolean "initializing" flag let a stale Strict Mode run block the live one, leaving an empty map.)
  const mountGenerationRef = useRef<number>(0);
  const googleFailedRef = useRef<boolean>(false);
  const animFrameIdRef = useRef<number | null>(null);
  const prevSelectedTripIdRef = useRef<string | undefined>(undefined);
  const prevSelectedStopIdRef = useRef<string | undefined>(undefined);
  const hasCenteredInitialTripRef = useRef<boolean>(false);
  // Set while the component itself moves the camera, so those moves don't count as user interaction
  const programmaticMoveRef = useRef<boolean>(false);
  const vehicleTweensRef = useRef<Map<string, number>>(new Map());
  // Last displayed progress along the planned road per trip, for along-road animation
  const vehicleAlongRef = useRef<Map<string, number>>(new Map());
  const accuracyCircleRef = useRef<import('leaflet').Circle | null>(null);

  // `center` is often a fresh array literal each render; keep it out of effect deps so polling
  // re-renders never tear down and rebuild the map (which reset the viewport to the origin and
  // crashed in-flight zoom animations with "_leaflet_pos" errors).
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(zoom);

  // Selected vehicle location
  const selectedVehicleLocation = useMemo(() => {
    if (!selectedTripId) return undefined;
    return activeLocations.find((l) => l.tripId === selectedTripId);
  }, [selectedTripId, activeLocations]);

  const selectedVehicleLocationRef = useRef(selectedVehicleLocation);

  // Keep latest values for the async map init; declared before the mount effect so it runs first
  useEffect(() => {
    initialCenterRef.current = center;
    initialZoomRef.current = zoom;
    selectedVehicleLocationRef.current = selectedVehicleLocation;
  });

  // Selected route object
  const selectedRouteObj = useMemo(() => {
    if (!selectedRouteId) return undefined;
    return routes.find((r) => r.id === selectedRouteId);
  }, [selectedRouteId, routes]);

  // Filtered stops for accessible table
  const displayedTableStops = useMemo(() => {
    if (tableFilterMode === 'selected_route' && selectedRouteObj && selectedRouteObj.stops.length > 0) {
      const sortedRouteStops = [...selectedRouteObj.stops].sort((a, b) => a.stopSequence - b.stopSequence);
      return sortedRouteStops.map((rs) => {
        const s = rs.stop || stops.find((item) => item.id === rs.stopId);
        return {
          stop: s,
          sequence: rs.stopSequence,
          scheduledTime: rs.scheduledTime,
        };
      }).filter((item): item is { stop: Stop; sequence: number; scheduledTime: string | undefined } => Boolean(item.stop));
    }
    return stops.map((s, idx) => ({
      stop: s,
      sequence: idx + 1,
      scheduledTime: undefined as string | undefined,
    }));
  }, [tableFilterMode, selectedRouteObj, stops]);

  // Clean up Leaflet map instance completely
  // Clean up Leaflet map instance completely
  const cleanupLeafletMap = useCallback(() => {
    if (leafletMapRef.current) {
      try {
        const map = leafletMapRef.current;
        leafletMapRef.current = null;
        vehicleTweensRef.current.forEach((id) => cancelAnimationFrame(id));
        vehicleTweensRef.current.clear();
        map.stop();
        map.off();
        vehicleMarkersMapRef.current.clear();
        leafletStopsLayerRef.current?.clearLayers();
        leafletRoutesLayerRef.current?.clearLayers();
        leafletVehiclesLayerRef.current?.clearLayers();
        map.remove();
      } catch {
        // Safe guard against unmount race
      }
      leafletStopsLayerRef.current = null;
      leafletRoutesLayerRef.current = null;
      leafletVehiclesLayerRef.current = null;
      setIsMapReady(false);
    }

    if (mapContainerRef.current) {
      const el = mapContainerRef.current as HTMLElement & { _leaflet_id?: unknown };
      if (el._leaflet_id !== undefined) {
        delete el._leaflet_id;
      }
      el.innerHTML = '';
    }
  }, []);

  // Clean up Google Maps instance completely
  const cleanupGoogleMap = useCallback(() => {
    googleMarkersRef.current.forEach((m) => m.setMap(null));
    googleMarkersRef.current = [];
    googlePolylinesRef.current.forEach((p) => p.setMap(null));
    googlePolylinesRef.current = [];
    googleMapRef.current = null;
    setIsMapReady(false);

    if (mapContainerRef.current) {
      mapContainerRef.current.innerHTML = '';
    }
  }, []);

  // Master cleanup for both providers
  const cleanupAllMaps = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    cleanupLeafletMap();
    cleanupGoogleMap();
  }, [cleanupLeafletMap, cleanupGoogleMap]);

  // Create Leaflet divIcon for a bus stop.
  // kind: 'origin' | 'destination' | 'route' (on the selected route) | 'other' (off-route, dimmed)
  const createStopIcon = useCallback((
    L: typeof import('leaflet'),
    kind: 'origin' | 'destination' | 'route' | 'other',
    label: string,
    isSelected: boolean,
    isPassed: boolean
  ) => {
    const safeLabel = escapeHtml(label);
    if (kind === 'other') {
      const size = isSelected ? 14 : 10;
      return L.divIcon({
        className: 'transit-stop-marker',
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${isSelected ? '#1c69d4' : '#94a3b8'};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
      });
    }
    if (kind === 'origin' || kind === 'destination') {
      const bg = kind === 'origin' ? '#16a34a' : '#0f172a';
      const inner = kind === 'origin'
        ? '<div style="width:8px;height:8px;border-radius:50%;background:#fff;"></div>'
        : '<div style="width:8px;height:8px;background:#fff;"></div>';
      const size = isSelected ? 26 : 22;
      return L.divIcon({
        className: 'transit-stop-marker',
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style="width:${size}px;height:${size}px;border-radius:${kind === 'origin' ? '50%' : '4px'};background:${bg};border:3px solid ${isSelected ? '#60a5fa' : '#fff'};box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;box-sizing:border-box;">${inner}</div>
            <div style="position:absolute;top:${size + 2}px;white-space:nowrap;background:#fff;color:#0f172a;font:700 10px system-ui,sans-serif;padding:1px 5px;border-radius:3px;box-shadow:0 1px 4px rgba(0,0,0,0.25);">${safeLabel}</div>
          </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
      });
    }
    const size = isSelected ? 24 : 20;
    return L.divIcon({
      className: 'transit-stop-marker',
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;box-sizing:border-box;background:${isSelected ? '#1c69d4' : '#fff'};color:${isSelected ? '#fff' : (isPassed ? '#94a3b8' : '#1c69d4')};border:3px solid ${isPassed ? '#94a3b8' : '#1c69d4'};box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font:800 9px system-ui,sans-serif;cursor:pointer;">${safeLabel}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }, []);

  // Camera helper: marks the move as programmatic so auto-follow isn't cancelled by our own moves
  const moveCamera = useCallback((fn: (map: LeafletMap) => void) => {
    const map = leafletMapRef.current;
    if (!map) return;
    programmaticMoveRef.current = true;
    map.once('moveend', () => {
      programmaticMoveRef.current = false;
    });
    fn(map);
  }, []);

  // Moves a vehicle marker to its new display position. When both the previous and new positions
  // are matched to the planned road, the marker travels along that road between them (display
  // interpolation only, never stored as a measurement). Otherwise it is placed directly, so it can
  // never be drawn cutting across buildings or fields.
  const placeMarker = useCallback((
    tripId: string,
    marker: LeafletMarker,
    to: LatLng,
    roadPath?: { line: LatLng[]; cum: number[]; fromM: number; toM: number }
  ) => {
    const prev = vehicleTweensRef.current.get(tripId);
    if (prev) cancelAnimationFrame(prev);
    vehicleTweensRef.current.delete(tripId);
    if (!roadPath || roadPath.toM <= roadPath.fromM || roadPath.toM - roadPath.fromM > 3000) {
      marker.setLatLng(to);
      return;
    }
    const duration = 1500;
    const t0 = performance.now();
    const step = (now: number) => {
      if (!leafletMapRef.current) return;
      const t = Math.min(1, (now - t0) / duration);
      const e = t * (2 - t);
      marker.setLatLng(pointAtDistance(roadPath.line, roadPath.fromM + (roadPath.toM - roadPath.fromM) * e, roadPath.cum));
      if (t < 1) {
        vehicleTweensRef.current.set(tripId, requestAnimationFrame(step));
      } else {
        vehicleTweensRef.current.delete(tripId);
      }
    };
    vehicleTweensRef.current.set(tripId, requestAnimationFrame(step));
  }, []);

  // Create Uber / Ola / Rapido Style Live Vehicle DivIcon
  const createUberBusIcon = useCallback((
    L: typeof import('leaflet'),
    isLive: boolean,
    busCode: string,
    speedKmH: number | null,
    heading: number | null,
    isSelected: boolean,
    offRoute: boolean
  ) => {
    const safeBusCode = escapeHtml(busCode);
    const hasHeading = heading !== null && Number.isFinite(heading);
    const beaconClass = isLive ? 'live' : 'stale';

    return L.divIcon({
      className: 'uber-vehicle-icon',
      html: `
        <div style="position: relative; width: 64px; height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <!-- Pulsing Radar Beacon (Uber/Ola Style) -->
          <div class="radar-beacon ${beaconClass}"></div>

          <!-- Vehicle Center Disc with Directional Heading Arrow -->
          <div style="
            position: relative;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: ${isSelected ? '#090d16' : '#1e293b'};
            border: 3px solid ${!isLive ? '#94a3b8' : offRoute ? '#f59e0b' : isSelected ? '#3b82f6' : '#22c55e'};
            box-shadow: 0 4px 16px rgba(0,0,0,0.55), ${isSelected ? '0 0 14px rgba(59,130,246,0.7)' : 'none'};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 2;
          ">
            <!-- Heading Pointer Arrow: only when the device reports a heading -->
            <div style="
              display: ${hasHeading ? 'block' : 'none'};
              position: absolute;
              top: 2px;
              left: 50%;
              width: 0;
              height: 0;
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-bottom: 7px solid ${isSelected ? '#60a5fa' : '#ffffff'};
              transform: translateX(-50%) rotate(${hasHeading ? heading : 0}deg);
              transform-origin: 50% 17px;
              transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            "></div>

            <!-- Bus Graphic SVG -->
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${isSelected ? '#60a5fa' : '#ffffff'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 6v6"/>
              <path d="M15 6v6"/>
              <path d="M2 12h19.6"/>
              <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4c-1.1 0-2.1.8-2.4 1.8l-1.4 5c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"/>
              <circle cx="7" cy="18" r="2"/>
              <path d="M9 18h5"/>
              <circle cx="16" cy="18" r="2"/>
            </svg>
          </div>

          <!-- Floating High-Contrast Badge: Bus Code + Speed -->
          <div style="
            position: absolute;
            bottom: -2px;
            background: #090d12;
            color: #ffffff;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 800;
            white-space: nowrap;
            border: 1px solid ${isSelected ? '#3b82f6' : '#334155'};
            box-shadow: 0 2px 8px rgba(0,0,0,0.45);
            display: flex;
            align-items: center;
            gap: 4px;
            z-index: 3;
          ">
            <span style="
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background-color: ${!isLive ? '#94a3b8' : offRoute ? '#f59e0b' : '#22c55e'};
              display: inline-block;
            "></span>
            <span>${safeBusCode}</span>
            ${speedKmH !== null && Number.isFinite(speedKmH) && isLive ? `<span style="color: #94a3b8; font-weight: 600; border-left: 1px solid #334155; padding-left: 4px;">${speedKmH} km/h</span>` : ''}
            ${!isLive ? '<span style="color: #94a3b8; font-weight: 600; border-left: 1px solid #334155; padding-left: 4px;">last seen</span>' : ''}
          </div>
        </div>
      `,
      iconSize: [64, 64],
      iconAnchor: [32, 32],
      popupAnchor: [0, -28],
    });
  }, []);

  // Update Leaflet map layers (Stops, Routes, Vehicles)
  const updateLeafletLayers = useCallback(async () => {
    const map = leafletMapRef.current;
    if (!map || !mapContainerRef.current) return;

    const L = (await import('leaflet')).default;
    if (!leafletMapRef.current || !mapContainerRef.current) return;

    // Clear routes and stops (routes & stops change with route selection)
    leafletRoutesLayerRef.current?.clearLayers();
    leafletStopsLayerRef.current?.clearLayers();

    const resolveStop = (rs: Route['stops'][number]) => rs.stop || stops.find((st) => st.id === rs.stopId);
    const selectedVehicle = selectedTripId ? activeLocations.find((l) => l.tripId === selectedTripId) : undefined;

    // Planned road path of the selected route (absent when the routing step found none)
    const selectedRoute = routes.find((r) => r.id === selectedRouteId);
    const roadLine: LatLng[] | undefined =
      selectedRoute?.geometry && selectedRoute.geometry.status !== 'unavailable' && selectedRoute.geometry.coordinates.length > 1
        ? selectedRoute.geometry.coordinates
        : undefined;
    const roadCum = roadLine ? cumulativeDistances(roadLine) : undefined;
    const selectedRouteStops = selectedRoute
      ? [...selectedRoute.stops]
          .sort((a, b) => a.stopSequence - b.stopSequence)
          .map((rs) => resolveStop(rs))
          .filter((st): st is Stop => Boolean(st && isValidCoordinate(st.latitude, st.longitude)))
      : [];

    // Bus progress along the road comes from server-side matching; only trusted when on-route
    const busAlongM =
      selectedVehicle?.matchStatus === 'on_route' && typeof selectedVehicle.alongRouteM === 'number' && roadLine
        ? selectedVehicle.alongRouteM
        : undefined;

    // 1. Routes: road geometry only. A route without a road path draws no line at all.
    routes.forEach((route) => {
      if (route.id === selectedRouteId) return;
      const g = route.geometry;
      if (!g || g.status === 'unavailable' || g.coordinates.length < 2 || !leafletRoutesLayerRef.current) return;
      const polyline = L.polyline(g.coordinates, {
        color: '#64748b',
        weight: 3,
        opacity: selectedRouteId ? 0.18 : 0.45,
      }).addTo(leafletRoutesLayerRef.current);
      polyline.bindTooltip(`Route ${escapeHtml(route.routeNumber)}`, { sticky: true });
      polyline.on('click', () => onSelectRoute?.(route.id));
    });

    if (roadLine && leafletRoutesLayerRef.current) {
      const lineOpts = { lineCap: 'round' as const, lineJoin: 'round' as const };
      const [travelled, remaining] = busAlongM !== undefined ? splitAtDistance(roadLine, busAlongM) : [[], roadLine];
      L.polyline(roadLine, { ...lineOpts, color: '#0b2a55', weight: 10, opacity: 0.85 }).addTo(leafletRoutesLayerRef.current);
      if (travelled.length > 1) {
        L.polyline(travelled, { ...lineOpts, color: '#94a3b8', weight: 6, opacity: 1 }).addTo(leafletRoutesLayerRef.current);
      }
      if (remaining.length > 1) {
        L.polyline(remaining, { ...lineOpts, color: '#1c69d4', weight: 6, opacity: 1 }).addTo(leafletRoutesLayerRef.current);
      }
    }

    // 2. Stops: origin / numbered / destination on the selected route, grey dots elsewhere.
    //    "Passed" is decided by position along the road, not straight-line proximity.
    const routeStopIndex = new Map<string, number>();
    selectedRouteStops.forEach((st, i) => routeStopIndex.set(st.id, i));
    const stopPassed = (st: Stop) =>
      busAlongM !== undefined && roadLine && roadCum
        ? distanceAlong([st.latitude, st.longitude], roadLine, roadCum).alongM < busAlongM - 50
        : false;
    const totalOnRoute = selectedRoute?.stops.length ?? 0;

    stops.forEach((stop) => {
      if (!isValidCoordinate(stop.latitude, stop.longitude)) return;
      const isSelected = selectedStopId === stop.id;
      const idx = routeStopIndex.get(stop.id);
      const seq = idx !== undefined ? selectedRoute!.stops.find((rs) => rs.stopId === stop.id)?.stopSequence : undefined;
      const kind: 'origin' | 'destination' | 'route' | 'other' = seq === undefined
        ? 'other'
        : seq === 1
          ? 'origin'
          : seq === totalOnRoute
            ? 'destination'
            : 'route';
      const label = kind === 'origin' || kind === 'destination' ? stop.name : String(seq ?? '');
      const rs = selectedRoute?.stops.find((r) => r.stopId === stop.id);

      const marker = L.marker([stop.latitude, stop.longitude], {
        icon: createStopIcon(L, kind, label, isSelected, kind !== 'other' && stopPassed(stop)),
        zIndexOffset: isSelected ? 1500 : idx !== undefined ? 1000 : 100,
      });

      const approx = stop.coordinateStatus === 'geocoded_unverified';
      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; min-width: 190px; padding: 2px;">
          <div style="font-size: 10px; font-weight: 700; color: #1c69d4; text-transform: uppercase;">${seq !== undefined ? `Stop ${seq} of ${totalOnRoute}` : 'Pickup point'}</div>
          <div style="font-size: 14px; font-weight: 800; margin: 2px 0;">${escapeHtml(stop.name)}</div>
          ${rs?.scheduledTime ? `<div style="font-size: 12px; margin-bottom: 4px;">Scheduled: <strong>${escapeHtml(rs.scheduledTime)}</strong></div>` : ''}
          <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">${escapeHtml(stop.description || '')}</div>
          ${approx ? '<div style="font-size: 11px; color: #b45309; border-top: 1px solid #e2e8f0; padding-top: 6px;">Approximate location (geocoded, not yet verified)</div>' : ''}
        </div>
      `);

      marker.on('click', () => {
        onSelectStop?.(stop.id);
        setSelectedItem({
          type: 'stop',
          id: stop.id,
          title: stop.name,
          details: `${rs?.scheduledTime ? `Scheduled ${rs.scheduledTime} · ` : ''}${stop.description || ''}`,
          status: approx ? 'Approximate location' : 'Located',
          coordinates: [stop.latitude, stop.longitude],
        });
      });

      if (leafletStopsLayerRef.current) {
        marker.addTo(leafletStopsLayerRef.current);
      }
    });

    // 3. Vehicles: persistent markers updated in place. Display position is the road-matched point
    //    when the observation matched the planned road, otherwise the raw GPS observation.
    const currentActiveTripIds = new Set<string>();

    activeLocations.forEach((loc) => {
      if (!isValidCoordinate(loc.latitude, loc.longitude)) return;

      currentActiveTripIds.add(loc.tripId);
      const isSelected = selectedTripId === loc.tripId;
      const busCode = loc.bus?.busCode || 'Bus';
      const onRoute = loc.matchStatus === 'on_route' && isValidCoordinate(loc.matchedLatitude, loc.matchedLongitude);
      const display: LatLng = onRoute ? [loc.matchedLatitude!, loc.matchedLongitude!] : [loc.latitude, loc.longitude];
      const speed = typeof loc.speedKmH === 'number' && Number.isFinite(loc.speedKmH) ? loc.speedKmH : null;
      const heading = typeof loc.heading === 'number' && Number.isFinite(loc.heading) ? loc.heading : null;
      const formattedTime = new Date(loc.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      const matchText: Record<string, string> = {
        on_route: `On planned route${typeof loc.routeOffsetM === 'number' ? ` (GPS ${loc.routeOffsetM} m from road line)` : ''}`,
        off_route: `Off planned route by ~${loc.routeOffsetM ?? '?'} m`,
        low_accuracy: `GPS accuracy too low to match (±${loc.accuracyMeters} m)`,
        ambiguous: 'Position matches the route in more than one place',
        no_route: 'No planned road path for this route',
      };

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 210px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 700; color: #1c69d4; text-transform: uppercase;">Live GPS</span>
            <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 2px; background-color: ${loc.isLive ? '#dcfce7' : '#f1f5f9'}; color: ${loc.isLive ? '#15803d' : '#475569'};">
              ${loc.isLive ? 'LIVE' : 'STALE'}
            </span>
          </div>
          <div style="font-size: 15px; font-weight: 800; margin: 2px 0;">${escapeHtml(busCode)}${loc.bus?.registrationNumber ? ` (${escapeHtml(loc.bus.registrationNumber)})` : ''}</div>
          ${loc.routeName ? `<div style="font-size: 12px; margin-bottom: 4px;">Route: <strong>${escapeHtml(loc.routeName)}</strong></div>` : ''}
          <div style="font-size: 12px; margin-bottom: 4px;">
            Speed: <strong>${speed !== null ? `${speed} km/h` : 'not reported'}</strong> · Heading: <strong>${heading !== null ? `${heading}°` : 'not reported'}</strong>
          </div>
          <div style="font-size: 12px; margin-bottom: 6px;">${escapeHtml(matchText[loc.matchStatus ?? 'no_route'] ?? '')} · ±${loc.accuracyMeters} m</div>
          <div style="font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 4px;">GPS fix: ${formattedTime} IST</div>
        </div>
      `;

      const newIcon = createUberBusIcon(L, loc.isLive, busCode, speed, heading, isSelected, !onRoute);
      const existingMarker = vehicleMarkersMapRef.current.get(loc.tripId);
      const prevAlong = vehicleAlongRef.current.get(loc.tripId);
      const alongNow = onRoute && typeof loc.alongRouteM === 'number' ? loc.alongRouteM : undefined;

      if (existingMarker) {
        const animate = loc.isLive && isSelected && roadLine && roadCum && prevAlong !== undefined && alongNow !== undefined;
        placeMarker(
          loc.tripId,
          existingMarker,
          display,
          animate ? { line: roadLine!, cum: roadCum!, fromM: prevAlong!, toM: alongNow! } : undefined
        );
        existingMarker.setIcon(newIcon);
        existingMarker.setZIndexOffset(isSelected ? 3000 : 2000);
        existingMarker.setPopupContent(popupHtml);
      } else {
        const marker = L.marker(display, { icon: newIcon, zIndexOffset: isSelected ? 3000 : 2000 });
        marker.bindPopup(popupHtml);
        marker.on('click', () => {
          onSelectTrip?.(loc.tripId);
          setIsAutoFollowing(true);
          setSelectedItem({
            type: 'bus',
            id: loc.tripId,
            title: busCode,
            details: loc.routeName || '',
            status: loc.isLive ? 'Live GPS' : 'GPS stale',
            speed: speed ?? undefined,
            heading: heading ?? undefined,
            lastUpdated: formattedTime,
            coordinates: display,
          });
          const at = marker.getLatLng();
          moveCamera((m) => m.setView(at, Math.max(m.getZoom(), 15), { animate: true }));
        });
        if (leafletVehiclesLayerRef.current) {
          marker.addTo(leafletVehiclesLayerRef.current);
          vehicleMarkersMapRef.current.set(loc.tripId, marker);
        }
      }
      if (alongNow !== undefined) vehicleAlongRef.current.set(loc.tripId, alongNow);
      else vehicleAlongRef.current.delete(loc.tripId);

      // Accuracy circle around the raw observation of the selected bus when it isn't road-matched
      if (isSelected) {
        accuracyCircleRef.current?.remove();
        accuracyCircleRef.current = null;
        if (!onRoute && leafletVehiclesLayerRef.current) {
          accuracyCircleRef.current = L.circle([loc.latitude, loc.longitude], {
            radius: Math.max(loc.accuracyMeters, 5),
            color: '#f59e0b',
            weight: 1,
            fillOpacity: 0.12,
            interactive: false,
          }).addTo(leafletVehiclesLayerRef.current);
        }
      }
    });

    if (!selectedVehicle) {
      accuracyCircleRef.current?.remove();
      accuracyCircleRef.current = null;
    }

    // Remove markers for trips that no longer report
    vehicleMarkersMapRef.current.forEach((marker, tripId) => {
      if (!currentActiveTripIds.has(tripId)) {
        leafletVehiclesLayerRef.current?.removeLayer(marker);
        vehicleMarkersMapRef.current.delete(tripId);
        vehicleAlongRef.current.delete(tripId);
      }
    });

    // 4. Uber / Ola Style Auto-Follow Camera:
    // If tracking is active and auto-follow is on, keep the camera centered on the vehicle
    if (selectedTripId && isAutoFollowing && leafletMapRef.current) {
      const targetLoc = activeLocations.find((l) => l.tripId === selectedTripId);
      if (targetLoc && isValidCoordinate(targetLoc.latitude, targetLoc.longitude)) {
        const target: LatLng = targetLoc.matchStatus === 'on_route' && isValidCoordinate(targetLoc.matchedLatitude, targetLoc.matchedLongitude)
          ? [targetLoc.matchedLatitude!, targetLoc.matchedLongitude!]
          : [targetLoc.latitude, targetLoc.longitude];
        // Zoom in only on the first follow; afterwards keep the user's zoom level and just pan
        if (!hasCenteredInitialTripRef.current) {
          moveCamera((m) => m.setView(target, Math.max(m.getZoom(), 15), { animate: true }));
          hasCenteredInitialTripRef.current = true;
        } else if (targetLoc.isLive) {
          moveCamera((m) => m.panTo(target, { animate: true, duration: 0.8 }));
        }
      }
    }
  }, [
    stops,
    routes,
    selectedRouteId,
    selectedTripId,
    selectedStopId,
    activeLocations,
    isAutoFollowing,
    createStopIcon,
    createUberBusIcon,
    moveCamera,
    placeMarker,
    onSelectRoute,
    onSelectStop,
    onSelectTrip,
  ]);

  // Update Google Maps layers (fallback)
  const updateGoogleLayers = useCallback(() => {
    const map = googleMapRef.current;
    if (!map || !mapContainerRef.current) return;

    googleMarkersRef.current.forEach((m) => m.setMap(null));
    googleMarkersRef.current = [];
    googlePolylinesRef.current.forEach((p) => p.setMap(null));
    googlePolylinesRef.current = [];

    // Stops
    stops.forEach((stop) => {
      if (!isValidCoordinate(stop.latitude, stop.longitude)) return;
      const pos = { lat: stop.latitude, lng: stop.longitude };
      const isSelected = selectedStopId === stop.id;

      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: `${stop.name} (${stop.code})`,
        zIndex: isSelected ? 500 : 100,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 8 : 6,
          fillColor: isSelected ? '#1c69d4' : '#0f172a',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => {
        onSelectStop?.(stop.id);
      });

      googleMarkersRef.current.push(marker);
    });

    // Routes
    routes.forEach((route) => {
      const isSelected = selectedRouteId === route.id;
      // Road geometry only; routes without a computed road path are not drawn
      const g = route.geometry;
      const path = g && g.status !== 'unavailable' ? g.coordinates.map(([lat, lng]) => ({ lat, lng })) : [];

      if (path.length > 1) {
        const polyline = new google.maps.Polyline({
          path,
          strokeColor: isSelected ? '#1c69d4' : '#94a3b8',
          strokeOpacity: isSelected ? 0.95 : 0.6,
          strokeWeight: isSelected ? 5 : 3,
          map,
        });
        googlePolylinesRef.current.push(polyline);
      }
    });

    // Vehicles
    activeLocations.forEach((loc) => {
      if (!isValidCoordinate(loc.latitude, loc.longitude)) return;
      const isSelected = selectedTripId === loc.tripId;
      const busPos = { lat: loc.latitude, lng: loc.longitude };
      const busCode = loc.bus?.busCode || 'BUS';

      const marker = new google.maps.Marker({
        position: busPos,
        map,
        title: `${busCode} (${loc.speedKmH} km/h)`,
        zIndex: isSelected ? 3000 : 2000,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: isSelected ? 8 : 6,
          rotation: loc.heading || 0,
          fillColor: isSelected ? '#2563eb' : (loc.isLive ? '#22c55e' : '#f59e0b'),
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => {
        onSelectTrip?.(loc.tripId);
      });

      googleMarkersRef.current.push(marker);
    });

    // Auto follow in Google Maps
    if (selectedTripId && isAutoFollowing && googleMapRef.current) {
      const targetLoc = activeLocations.find((l) => l.tripId === selectedTripId);
      if (targetLoc && isValidCoordinate(targetLoc.latitude, targetLoc.longitude)) {
        googleMapRef.current.panTo({ lat: targetLoc.latitude, lng: targetLoc.longitude });
      }
    }
  }, [stops, routes, selectedRouteId, selectedTripId, selectedStopId, activeLocations, isAutoFollowing, onSelectStop, onSelectTrip]);

  // Initialize Leaflet Map instance once
  const initLeafletMapInstance = useCallback(async (isCurrent: () => boolean) => {
    const container = mapContainerRef.current;
    if (!container || !isCurrent()) return;
    if (leafletMapRef.current) return; // Map already active, do not recreate

    cleanupLeafletMap();

    const el = container as HTMLElement & { _leaflet_id?: unknown };
    if (el._leaflet_id !== undefined) {
      delete el._leaflet_id;
    }
    container.innerHTML = '';

    const L = (await import('leaflet')).default;
    if (!mapContainerRef.current || !isCurrent() || leafletMapRef.current) return;

    // Center on selected vehicle if available at mount time, else center prop
    const initialLoc = selectedVehicleLocationRef.current;
    const initialCenter = initialLoc && isValidCoordinate(initialLoc.latitude, initialLoc.longitude)
      ? [initialLoc.latitude, initialLoc.longitude] as [number, number]
      : initialCenterRef.current;

    const map = L.map(container, {
      center: initialCenter,
      zoom: initialLoc ? 15 : initialZoomRef.current,
      zoomControl: true,
      fadeAnimation: false,
    });
    leafletMapRef.current = map;

    // Detect manual user dragging and zooming to pause auto-follow
    map.on('dragstart', () => {
      setIsAutoFollowing(false);
    });
    map.on('zoomstart', () => {
      if (!programmaticMoveRef.current) setIsAutoFollowing(false);
    });

    // Standard OpenStreetMap tiles - zero watermarks
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    leafletRoutesLayerRef.current = L.layerGroup().addTo(map);
    leafletStopsLayerRef.current = L.layerGroup().addTo(map);
    leafletVehiclesLayerRef.current = L.layerGroup().addTo(map);

    // Invalidate size once container layout stabilizes
    animFrameIdRef.current = requestAnimationFrame(() => {
      try {
        if (leafletMapRef.current && mapContainerRef.current) {
          leafletMapRef.current.invalidateSize({ animate: false });
        }
      } catch {
        // Safe guard
      }
    });

    // Signal map readiness so layer update triggers immediately
    setIsMapReady(true);
  }, [cleanupLeafletMap]);

  // Initialize Google Maps instance once
  const initGoogleMapInstance = useCallback(async (apiKey: string, isCurrent: () => boolean) => {
    const container = mapContainerRef.current;
    if (!container || !isCurrent()) return;

    cleanupGoogleMap();

    setOptions({
      key: apiKey,
      v: 'weekly',
    });

    const { Map } = (await importLibrary('maps')) as google.maps.MapsLibrary;
    if (!mapContainerRef.current || !isCurrent()) return;

    const map = new Map(container, {
      center: { lat: initialCenterRef.current[0], lng: initialCenterRef.current[1] },
      zoom: initialZoomRef.current,
      mapTypeId: 'roadmap',
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
        { featureType: 'transit.station', stylers: [{ visibility: 'on' }] },
      ],
    });

    map.addListener('dragstart', () => {
      setIsAutoFollowing(false);
    });
    map.addListener('zoom_changed', () => {
      setIsAutoFollowing(false);
    });

    googleMapRef.current = map;
    setIsMapReady(true);
  }, [cleanupGoogleMap]);

  // Main Effect: Initializes Map Engine ONCE on mount
  useEffect(() => {
    const generation = ++mountGenerationRef.current;
    const isCurrent = () => mountGenerationRef.current === generation;

    if (activeTab !== 'map') {
      cleanupAllMaps();
      return;
    }

    const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
    const shouldAttemptGoogle = Boolean(googleApiKey && !googleFailedRef.current);

    let isEffectActive = true;

    async function mountMapEngine() {
      try {
        if (shouldAttemptGoogle && googleApiKey) {
          try {
            await initGoogleMapInstance(googleApiKey, isCurrent);
            if (!isEffectActive) return;
            setMapProvider('google');
            setGoogleLoadError(null);
            return;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Google Maps initialization failed';
            console.warn('Google Maps API unavailable, falling back to OpenStreetMap:', msg);
            googleFailedRef.current = true;
            if (isEffectActive) {
              setGoogleLoadError(msg);
            }
          }
        }

        // Initialize high-performance OpenStreetMap via Leaflet
        await initLeafletMapInstance(isCurrent);
        if (!isEffectActive) return;
        setMapProvider('leaflet');
      } catch (err) {
        console.error('Leaflet initialization error:', err);
      }
    }

    mountMapEngine();

    return () => {
      isEffectActive = false;
      mountGenerationRef.current++;
      cleanupAllMaps();
    };
  }, [activeTab, initGoogleMapInstance, initLeafletMapInstance, cleanupAllMaps]);

  // Layer Update Effect: Runs whenever map is ready or telemetry/routes/stops update
  useEffect(() => {
    if (activeTab !== 'map' || !isMapReady) return;

    if (mapProvider === 'leaflet' && leafletMapRef.current) {
      updateLeafletLayers();
    } else if (mapProvider === 'google' && googleMapRef.current) {
      updateGoogleLayers();
    }
  }, [
    activeTab,
    isMapReady,
    mapProvider,
    stops,
    routes,
    selectedRouteId,
    selectedTripId,
    selectedStopId,
    activeLocations,
    isAutoFollowing,
    updateLeafletLayers,
    updateGoogleLayers,
  ]);

  // Points that describe a route's extent: its road path, else its located stops
  const routeExtent = useCallback((route: Route | undefined): LatLng[] => {
    if (!route) return [];
    if (route.geometry && route.geometry.status !== 'unavailable' && route.geometry.coordinates.length > 1) {
      return route.geometry.coordinates;
    }
    return route.stops
      .map((rs) => rs.stop || stops.find((s) => s.id === rs.stopId))
      .filter((s): s is Stop => Boolean(s && isValidCoordinate(s.latitude, s.longitude)))
      .map((s) => [s.latitude, s.longitude] as LatLng);
  }, [stops]);

  // Camera Focus when user selects a different trip or stop
  useEffect(() => {
    if (activeTab !== 'map') return;

    if (selectedTripId && selectedTripId !== prevSelectedTripIdRef.current) {
      prevSelectedTripIdRef.current = selectedTripId;
      setIsAutoFollowing(true); // Automatically resume auto-follow on trip switch
      hasCenteredInitialTripRef.current = false;

      const loc = activeLocations.find((l) => l.tripId === selectedTripId);
      if (loc && isValidCoordinate(loc.latitude, loc.longitude)) {
        // Tracking starts centred on the bus
        if (leafletMapRef.current) {
          moveCamera((m) => m.setView([loc.latitude, loc.longitude], 15, { animate: true }));
        } else if (googleMapRef.current) {
          googleMapRef.current.panTo({ lat: loc.latitude, lng: loc.longitude });
          googleMapRef.current.setZoom(15);
        }
      } else {
        // No GPS for this trip: show its planned route once, on this deliberate selection
        const extent = routeExtent(selectedRouteObj);
        if (extent.length > 1 && leafletMapRef.current) {
          moveCamera((m) => m.fitBounds(extent, { padding: [40, 40], maxZoom: 15, animate: true }));
        }
      }
      return;
    }

    if (selectedStopId && selectedStopId !== prevSelectedStopIdRef.current) {
      prevSelectedStopIdRef.current = selectedStopId;
      const stop = stops.find((s) => s.id === selectedStopId);
      if (stop && isValidCoordinate(stop.latitude, stop.longitude)) {
        if (leafletMapRef.current) {
          moveCamera((m) => m.setView([stop.latitude, stop.longitude], 16, { animate: true }));
        } else if (googleMapRef.current) {
          googleMapRef.current.panTo({ lat: stop.latitude, lng: stop.longitude });
          googleMapRef.current.setZoom(16);
        }
      }
    }
  }, [selectedTripId, selectedStopId, activeLocations, stops, activeTab, moveCamera, routeExtent, selectedRouteObj]);

  // Camera Actions
  const handleRecenterOnBus = useCallback(() => {
    setIsAutoFollowing(true);
    if (!selectedVehicleLocation || !isValidCoordinate(selectedVehicleLocation.latitude, selectedVehicleLocation.longitude)) {
      return;
    }
    if (leafletMapRef.current) {
      moveCamera((m) => m.setView(
        [selectedVehicleLocation.latitude, selectedVehicleLocation.longitude],
        15,
        { animate: true }
      ));
    } else if (googleMapRef.current) {
      googleMapRef.current.panTo({
        lat: selectedVehicleLocation.latitude,
        lng: selectedVehicleLocation.longitude,
      });
      googleMapRef.current.setZoom(15);
    }
  }, [selectedVehicleLocation, moveCamera]);

  const handleShowFullRoute = useCallback(() => {
    setIsAutoFollowing(false);
    const validCoords = routeExtent(selectedRouteObj);
    if (validCoords.length === 0) return;

    if (leafletMapRef.current) {
      moveCamera((m) => m.fitBounds(validCoords, { padding: [40, 40], maxZoom: 15, animate: true }));
    } else if (googleMapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      validCoords.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
      googleMapRef.current.fitBounds(bounds, 40);
    }
  }, [selectedRouteObj, routeExtent, moveCamera]);

  const handleShowAllBuses = useCallback(() => {
    setIsAutoFollowing(false);
    const allCoords: [number, number][] = [];
    activeLocations.forEach((loc) => {
      if (isValidCoordinate(loc.latitude, loc.longitude)) {
        allCoords.push([loc.latitude, loc.longitude]);
      }
    });
    stops.forEach((s) => {
      if (isValidCoordinate(s.latitude, s.longitude)) {
        allCoords.push([s.latitude, s.longitude]);
      }
    });

    if (allCoords.length === 0) return;

    if (leafletMapRef.current && mapContainerRef.current) {
      try {
        leafletMapRef.current.fitBounds(allCoords, {
          padding: [30, 30],
          animate: false,
          maxZoom: 13,
        });
      } catch {
        // Safe guard
      }
    }
  }, [activeLocations, stops]);

  const handleLocateStop = useCallback((stop: Stop) => {
    if (!isValidCoordinate(stop.latitude, stop.longitude)) return;
    setIsAutoFollowing(false);
    setActiveTab('map');
    onSelectStop?.(stop.id);

    moveCamera((m) => m.setView([stop.latitude, stop.longitude], 16, { animate: true }));
  }, [onSelectStop, moveCamera]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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

          {/* Live Auto-Follow Indicator */}
          {isAutoFollowing && selectedVehicleLocation && (
            <span
              style={{
                backgroundColor: '#064e3b',
                color: '#6ee7b7',
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                letterSpacing: '0.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span className="live-pulse" style={{ width: '6px', height: '6px' }}></span>
              CAMERA FOLLOWING {selectedVehicleLocation.bus?.busCode || 'BUS'}
            </span>
          )}
        </div>

        {/* View Mode & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {activeTab === 'map' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={handleShowFullRoute}
                disabled={!selectedRouteObj}
                title={selectedRouteObj ? 'Fit map to selected route corridor' : 'Select a route to focus'}
                className="btn btn-sm btn-outline-light"
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  opacity: selectedRouteObj ? 1 : 0.5,
                  cursor: selectedRouteObj ? 'pointer' : 'not-allowed',
                }}
              >
                <Maximize2 size={13} />
                <span>Show Corridor</span>
              </button>

              <button
                type="button"
                onClick={handleShowAllBuses}
                title="Fit map to entire campus transit network"
                className="btn btn-sm btn-outline-light"
                style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Radio size={13} />
                <span>All Buses</span>
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`btn btn-sm ${activeTab === 'map' ? 'btn-primary' : 'btn-outline-dark'}`}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              Interactive Map
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('accessible-list')}
              className={`btn btn-sm ${activeTab === 'accessible-list' ? 'btn-primary' : 'btn-outline-dark'}`}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              Accessible Table ({displayedTableStops.length} Stops)
            </button>
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} color="#1d4ed8" />
            <span>
              <strong>Map Provider Note:</strong> Google Maps key is pending activation; automatically serving high-performance OpenStreetMap tiles without disruption.
            </span>
          </div>
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

          {/* Planned road path status for the selected route */}
          {selectedRouteObj && selectedRouteObj.geometry?.status !== 'ok' && (
            <div
              role="status"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                maxWidth: '320px',
                zIndex: 1000,
                backgroundColor: '#ffffff',
                border: '1px solid var(--color-hairline-strong)',
                padding: '8px 12px',
                fontSize: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              {!selectedRouteObj.geometry || selectedRouteObj.geometry.status === 'unavailable' ? (
                <>
                  <strong>Road path unavailable.</strong>{' '}
                  {selectedRouteObj.geometry?.reason === 'Fewer than two located stops'
                    ? 'Too few stops on this route have a known location.'
                    : selectedRouteObj.geometry?.reason || 'No road path has been computed for this route.'}
                </>
              ) : (
                <>
                  <strong>Partial road path.</strong> Drawn through{' '}
                  {selectedRouteObj.stops.length - (selectedRouteObj.geometry.excludedStops?.length ?? 0)} of{' '}
                  {selectedRouteObj.stops.length} stops
                  {selectedRouteObj.geometry.excludedStops?.length ? '; the others have no verified location yet.' : '.'}
                </>
              )}
            </div>
          )}

          {/* Uber/Ola Style Floating Re-center Pill Button: appears when user panned away */}
          {!isAutoFollowing && selectedVehicleLocation && (
            <div
              style={{
                position: 'absolute',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
              }}
            >
              <button
                type="button"
                onClick={handleRecenterOnBus}
                className="btn btn-primary"
                style={{
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 800,
                  borderRadius: '30px',
                }}
              >
                <Crosshair size={15} />
                <span>Re-center on {selectedVehicleLocation.bus?.busCode || 'Bus'}</span>
              </button>
            </div>
          )}

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
                boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span className="badge badge-neutral">{selectedItem.status}</span>

                {selectedItem.type === 'bus' && (
                  <button
                    type="button"
                    onClick={handleRecenterOnBus}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Crosshair size={12} />
                    <span>Follow Bus</span>
                  </button>
                )}

                {selectedRouteObj && (
                  <button
                    type="button"
                    onClick={handleShowFullRoute}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Maximize2 size={12} />
                    <span>View Corridor</span>
                  </button>
                )}

                <button
                  type="button"
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--color-hairline)',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
                {tableFilterMode === 'selected_route' && selectedRouteObj
                  ? `Stops along ${selectedRouteObj.routeName}`
                  : 'All Transit Stops & Pickups across Corridors'}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '2px 0 0' }}>
                Select any stop to locate and center on the interactive map.
              </p>
            </div>

            {selectedRouteObj && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setTableFilterMode('selected_route')}
                  className={`btn btn-sm ${tableFilterMode === 'selected_route' ? 'btn-primary' : 'btn-outline-dark'}`}
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  Selected Route Only ({selectedRouteObj.stops.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilterMode('all')}
                  className={`btn btn-sm ${tableFilterMode === 'all' ? 'btn-primary' : 'btn-outline-dark'}`}
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  All Campus Stops ({stops.length})
                </button>
              </div>
            )}
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Seq</th>
                <th>Stop Code</th>
                <th>Pickup Location Name</th>
                <th>Scheduled Time</th>
                <th>Area</th>
                <th>Location</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedTableStops.map(({ stop, sequence, scheduledTime }) => {
                const isSelected = selectedStopId === stop.id;
                const hasLocation = isValidCoordinate(stop.latitude, stop.longitude);

                return (
                  <tr
                    key={stop.id}
                    style={{
                      backgroundColor: isSelected ? 'var(--color-surface-soft)' : undefined,
                    }}
                  >
                    <td><strong>#{sequence}</strong></td>
                    <td><code style={{ fontSize: '11px', fontWeight: 700 }}>{stop.code}</code></td>
                    <td style={{ fontWeight: 700 }}>{stop.name}</td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {scheduledTime || '—'}
                      </span>
                    </td>
                    <td>{stop.landmark}</td>
                    <td>
                      {!hasLocation ? (
                        <span className="badge badge-neutral">Not yet located</span>
                      ) : stop.coordinateStatus === 'geocoded_unverified' ? (
                        <span className="badge badge-neutral">Approximate</span>
                      ) : (
                        <span className="badge badge-success">Located</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleLocateStop(stop)}
                        disabled={!hasLocation}
                        className="btn btn-outline-dark btn-sm"
                        style={{ fontSize: '10px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <MapPin size={11} />
                        <span>Locate</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
