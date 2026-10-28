'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Map as LeafletMap, LayerGroup as LeafletLayerGroup, Marker as LeafletMarker } from 'leaflet';
import { Route, Stop, GPSLocation, Bus } from '@/types/transit';
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
  const isInitializingRef = useRef<boolean>(false);
  const isDestroyedRef = useRef<boolean>(false);
  const googleFailedRef = useRef<boolean>(false);
  const animFrameIdRef = useRef<number | null>(null);
  const prevSelectedTripIdRef = useRef<string | undefined>(undefined);
  const prevSelectedStopIdRef = useRef<string | undefined>(undefined);
  const hasCenteredInitialTripRef = useRef<boolean>(false);

  // Selected vehicle location
  const selectedVehicleLocation = useMemo(() => {
    if (!selectedTripId) return undefined;
    return activeLocations.find((l) => l.tripId === selectedTripId);
  }, [selectedTripId, activeLocations]);

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
          arrivalOffsetMinutes: rs.arrivalOffsetMinutes,
        };
      }).filter((item): item is { stop: Stop; sequence: number; arrivalOffsetMinutes: number } => Boolean(item.stop));
    }
    return stops.map((s, idx) => ({
      stop: s,
      sequence: idx + 1,
      arrivalOffsetMinutes: 0,
    }));
  }, [tableFilterMode, selectedRouteObj, stops]);

  // Clean up Leaflet map instance completely
  const cleanupLeafletMap = useCallback(() => {
    if (leafletMapRef.current) {
      try {
        leafletMapRef.current.stop();
        vehicleMarkersMapRef.current.clear();
        leafletStopsLayerRef.current?.clearLayers();
        leafletRoutesLayerRef.current?.clearLayers();
        leafletVehiclesLayerRef.current?.clearLayers();
        leafletMapRef.current.remove();
      } catch {
        // Safe guard against unmount race
      }
      leafletMapRef.current = null;
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

  // Create Leaflet divIcon for a bus stop
  const createStopIcon = useCallback((L: typeof import('leaflet'), code: string, isSelected: boolean) => {
    const displayCode = escapeHtml(code.length > 5 ? code.slice(-5) : code);
    return L.divIcon({
      className: 'transit-stop-marker',
      html: `
        <div style="
          background: ${isSelected ? '#1c69d4' : '#0f172a'};
          color: #f8fafc;
          width: ${isSelected ? '28px' : '24px'};
          height: ${isSelected ? '28px' : '24px'};
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
          border: ${isSelected ? '2.5px solid #60a5fa' : '1.5px solid #ffffff'};
          box-shadow: 0 ${isSelected ? '4px 12px rgba(28,105,212,0.5)' : '2px 6px rgba(0,0,0,0.35)'};
          cursor: pointer;
          transition: all 0.2s ease;
        ">
          <span>${displayCode}</span>
        </div>
      `,
      iconSize: isSelected ? [28, 28] : [24, 24],
      iconAnchor: isSelected ? [14, 14] : [12, 12],
      popupAnchor: [0, -14],
    });
  }, []);

  // Create Uber / Ola / Rapido Style Live Vehicle DivIcon
  const createUberBusIcon = useCallback((
    L: typeof import('leaflet'),
    isLive: boolean,
    busCode: string,
    speedKmH: number,
    heading: number,
    isSelected: boolean
  ) => {
    const safeBusCode = escapeHtml(busCode);
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
            border: 3px solid ${isSelected ? '#3b82f6' : (isLive ? '#22c55e' : '#f59e0b')};
            box-shadow: 0 4px 16px rgba(0,0,0,0.55), ${isSelected ? '0 0 14px rgba(59,130,246,0.7)' : 'none'};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 2;
          ">
            <!-- Heading Pointer Arrow: points in vehicle's direction of travel -->
            <div style="
              position: absolute;
              top: 2px;
              left: 50%;
              width: 0;
              height: 0;
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-bottom: 7px solid ${isSelected ? '#60a5fa' : '#ffffff'};
              transform: translateX(-50%) rotate(${heading || 0}deg);
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
              background-color: ${isLive ? '#22c55e' : '#f59e0b'};
              display: inline-block;
            "></span>
            <span>${safeBusCode}</span>
            <span style="color: #94a3b8; font-weight: 600; border-left: 1px solid #334155; padding-left: 4px;">${speedKmH}k</span>
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

    // 1. Render Routes (Polylines)
    routes.forEach((route) => {
      const isSelected = selectedRouteId === route.id;
      const sortedStops = [...route.stops].sort((a, b) => a.stopSequence - b.stopSequence);
      const latLngs = sortedStops
        .map((rs) => {
          const s = rs.stop || stops.find((st) => st.id === rs.stopId);
          if (s && isValidCoordinate(s.latitude, s.longitude)) {
            return [s.latitude, s.longitude] as [number, number];
          }
          return null;
        })
        .filter((c): c is [number, number] => c !== null);

      if (latLngs.length > 1 && leafletRoutesLayerRef.current) {
        const polyline = L.polyline(latLngs, {
          color: isSelected ? '#1c69d4' : '#94a3b8',
          weight: isSelected ? 6 : 3,
          opacity: isSelected ? 0.95 : 0.5,
          dashArray: isSelected ? undefined : '5, 8',
        }).addTo(leafletRoutesLayerRef.current);

        polyline.on('click', () => {
          onSelectRoute?.(route.id);
        });
      }
    });

    // 2. Render Stops
    stops.forEach((stop) => {
      if (!isValidCoordinate(stop.latitude, stop.longitude)) return;
      const isSelected = selectedStopId === stop.id;

      const marker = L.marker([stop.latitude, stop.longitude], {
        icon: createStopIcon(L, stop.code, isSelected),
        zIndexOffset: isSelected ? 500 : 100,
      });

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; min-width: 190px; padding: 2px;">
          <div style="font-size: 10px; font-weight: 700; color: #1c69d4; text-transform: uppercase;">Bus Stop</div>
          <div style="font-size: 14px; font-weight: 800; margin: 2px 0;">${escapeHtml(stop.name)}</div>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">${escapeHtml(stop.description || '')} (${escapeHtml(stop.landmark || '')})</div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 11px;">
            <span>Code: <strong>${escapeHtml(stop.code)}</strong></span>
            <span style="color: ${stop.isAccessible ? '#16a34a' : '#64748b'}; font-weight: 600;">
              ${stop.isAccessible ? '♿ Accessible' : 'Standard'}
            </span>
          </div>
        </div>
      `);

      marker.on('click', () => {
        onSelectStop?.(stop.id);
        setSelectedItem({
          type: 'stop',
          id: stop.id,
          title: stop.name,
          details: `${stop.description} (${stop.landmark})`,
          status: stop.isAccessible ? 'Wheelchair Accessible' : 'Standard Stop',
          coordinates: [stop.latitude, stop.longitude],
        });
      });

      if (leafletStopsLayerRef.current) {
        marker.addTo(leafletStopsLayerRef.current);
      }
    });

    // 3. Render / Update Moving Vehicles (Persistent markers for smooth Uber-like motion)
    const currentActiveTripIds = new Set<string>();

    activeLocations.forEach((loc) => {
      if (!isValidCoordinate(loc.latitude, loc.longitude)) return;

      currentActiveTripIds.add(loc.tripId);
      const isSelected = selectedTripId === loc.tripId;
      const busCode = loc.bus?.busCode || 'BUS';
      const formattedTime = new Date(loc.timestamp).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
      });

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 210px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 700; color: #1c69d4; text-transform: uppercase;">Live Telemetry</span>
            <span style="
              font-size: 10px;
              font-weight: 800;
              padding: 2px 6px;
              border-radius: 2px;
              background-color: ${loc.isLive ? '#dcfce7' : '#fef3c7'};
              color: ${loc.isLive ? '#15803d' : '#b45309'};
            ">
              ${loc.isLive ? 'LIVE' : 'STALE (>2m)'}
            </span>
          </div>
          <div style="font-size: 15px; font-weight: 800; margin: 2px 0;">${escapeHtml(busCode)} (${escapeHtml(loc.bus?.rawRegistration || loc.bus?.registrationNumber || 'AP39')})</div>
          <div style="font-size: 12px; margin-bottom: 4px;">Route: <strong>${escapeHtml(loc.routeName || 'Active Service')}</strong></div>
          <div style="font-size: 12px; margin-bottom: 6px;">Ground Speed: <strong>${loc.speedKmH} km/h</strong> • Heading: <strong>${loc.heading || 0}°</strong></div>
          <div style="font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 4px;">
            Last Update: ${formattedTime} IST
          </div>
        </div>
      `;

      const existingMarker = vehicleMarkersMapRef.current.get(loc.tripId);
      const newIcon = createUberBusIcon(L, loc.isLive, busCode, loc.speedKmH, loc.heading || 0, isSelected);

      if (existingMarker) {
        // Smoothly glide existing marker to new GPS coordinate without recreating DOM
        existingMarker.setLatLng([loc.latitude, loc.longitude]);
        existingMarker.setIcon(newIcon);
        existingMarker.setZIndexOffset(isSelected ? 3000 : 2000);
        existingMarker.setPopupContent(popupHtml);
      } else {
        // Create new marker
        const marker = L.marker([loc.latitude, loc.longitude], {
          icon: newIcon,
          zIndexOffset: isSelected ? 3000 : 2000,
        });

        marker.bindPopup(popupHtml);

        marker.on('click', () => {
          onSelectTrip?.(loc.tripId);
          setIsAutoFollowing(true);
          setSelectedItem({
            type: 'bus',
            id: loc.tripId,
            title: `Vehicle ${busCode}`,
            details: `Route: ${loc.routeName || 'Scheduled Commuter'} | Reg: ${loc.bus?.registrationNumber || 'AP39'}`,
            status: loc.isLive ? 'Active Telemetry' : 'Signal Stale (>2m)',
            speed: loc.speedKmH,
            heading: loc.heading,
            lastUpdated: formattedTime,
            coordinates: [loc.latitude, loc.longitude],
          });
          if (leafletMapRef.current) {
            leafletMapRef.current.setView([loc.latitude, loc.longitude], 15, { animate: true });
          }
        });

        if (leafletVehiclesLayerRef.current) {
          marker.addTo(leafletVehiclesLayerRef.current);
          vehicleMarkersMapRef.current.set(loc.tripId, marker);
        }
      }
    });

    // Remove any markers no longer in active locations
    vehicleMarkersMapRef.current.forEach((marker, tripId) => {
      if (!currentActiveTripIds.has(tripId)) {
        leafletVehiclesLayerRef.current?.removeLayer(marker);
        vehicleMarkersMapRef.current.delete(tripId);
      }
    });

    // 4. Uber / Ola Style Auto-Follow Camera:
    // If tracking is active and auto-follow is on, keep the camera centered on the vehicle
    if (selectedTripId && isAutoFollowing && leafletMapRef.current) {
      const targetLoc = activeLocations.find((l) => l.tripId === selectedTripId);
      if (targetLoc && isValidCoordinate(targetLoc.latitude, targetLoc.longitude)) {
        const curZoom = leafletMapRef.current.getZoom();
        if (curZoom < 14 || !hasCenteredInitialTripRef.current) {
          leafletMapRef.current.setView([targetLoc.latitude, targetLoc.longitude], 15, { animate: true });
          hasCenteredInitialTripRef.current = true;
        } else {
          leafletMapRef.current.panTo([targetLoc.latitude, targetLoc.longitude], {
            animate: true,
            duration: 0.8,
          });
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
      const sortedStops = [...route.stops].sort((a, b) => a.stopSequence - b.stopSequence);
      const path = sortedStops
        .map((rs) => {
          const s = rs.stop || stops.find((st) => st.id === rs.stopId);
          return s && isValidCoordinate(s.latitude, s.longitude)
            ? { lat: s.latitude, lng: s.longitude }
            : null;
        })
        .filter((c): c is google.maps.LatLngLiteral => c !== null);

      if (path.length > 1) {
        const polyline = new google.maps.Polyline({
          path,
          geodesic: true,
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
  const initLeafletMapInstance = useCallback(async () => {
    const container = mapContainerRef.current;
    if (!container || isDestroyedRef.current) return;

    cleanupLeafletMap();

    const el = container as HTMLElement & { _leaflet_id?: unknown };
    if (el._leaflet_id !== undefined) {
      delete el._leaflet_id;
    }
    container.innerHTML = '';

    const L = (await import('leaflet')).default;
    if (!mapContainerRef.current || isDestroyedRef.current) return;

    // Center on selected vehicle if available, else center prop
    const initialCenter = selectedVehicleLocation && isValidCoordinate(selectedVehicleLocation.latitude, selectedVehicleLocation.longitude)
      ? [selectedVehicleLocation.latitude, selectedVehicleLocation.longitude] as [number, number]
      : center;

    const map = L.map(container, {
      center: initialCenter,
      zoom: selectedVehicleLocation ? 15 : zoom,
      zoomControl: true,
      fadeAnimation: false,
    });
    leafletMapRef.current = map;

    // Detect manual user dragging to pause auto-follow
    map.on('dragstart', () => {
      setIsAutoFollowing(false);
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
  }, [center, zoom, selectedVehicleLocation, cleanupLeafletMap]);

  // Initialize Google Maps instance once
  const initGoogleMapInstance = useCallback(async (apiKey: string) => {
    const container = mapContainerRef.current;
    if (!container || isDestroyedRef.current) return;

    cleanupGoogleMap();

    setOptions({
      key: apiKey,
      v: 'weekly',
    });

    const { Map } = (await importLibrary('maps')) as google.maps.MapsLibrary;
    if (!mapContainerRef.current || isDestroyedRef.current) return;

    const map = new Map(container, {
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

    map.addListener('dragstart', () => {
      setIsAutoFollowing(false);
    });

    googleMapRef.current = map;
    setIsMapReady(true);
  }, [center, zoom, cleanupGoogleMap]);

  // Main Effect: Initializes Map Engine ONCE on mount
  useEffect(() => {
    isDestroyedRef.current = false;

    if (activeTab !== 'map') {
      cleanupAllMaps();
      return;
    }

    const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
    const shouldAttemptGoogle = Boolean(googleApiKey && !googleFailedRef.current);

    let isEffectActive = true;

    async function mountMapEngine() {
      if (isInitializingRef.current) return;
      isInitializingRef.current = true;

      try {
        if (shouldAttemptGoogle && googleApiKey) {
          try {
            await initGoogleMapInstance(googleApiKey);
            if (!isEffectActive || isDestroyedRef.current) {
              cleanupGoogleMap();
              return;
            }
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
        await initLeafletMapInstance();
        if (!isEffectActive || isDestroyedRef.current) {
          cleanupLeafletMap();
          return;
        }
        setMapProvider('leaflet');
      } catch (err) {
        console.error('Leaflet initialization error:', err);
      } finally {
        isInitializingRef.current = false;
      }
    }

    mountMapEngine();

    return () => {
      isEffectActive = false;
      isDestroyedRef.current = true;
      cleanupAllMaps();
    };
  }, [activeTab, initGoogleMapInstance, initLeafletMapInstance, cleanupAllMaps, cleanupGoogleMap, cleanupLeafletMap]);

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

  // Camera Focus when user selects a different trip or stop
  useEffect(() => {
    if (activeTab !== 'map') return;

    if (selectedTripId && selectedTripId !== prevSelectedTripIdRef.current) {
      prevSelectedTripIdRef.current = selectedTripId;
      setIsAutoFollowing(true); // Automatically resume auto-follow on trip switch
      hasCenteredInitialTripRef.current = false;

      const loc = activeLocations.find((l) => l.tripId === selectedTripId);
      if (loc && isValidCoordinate(loc.latitude, loc.longitude)) {
        if (leafletMapRef.current) {
          try {
            leafletMapRef.current.setView([loc.latitude, loc.longitude], 15, { animate: true });
          } catch {
            // Safe guard
          }
        } else if (googleMapRef.current) {
          googleMapRef.current.panTo({ lat: loc.latitude, lng: loc.longitude });
          googleMapRef.current.setZoom(15);
        }
      }
      return;
    }

    if (selectedStopId && selectedStopId !== prevSelectedStopIdRef.current) {
      prevSelectedStopIdRef.current = selectedStopId;
      const stop = stops.find((s) => s.id === selectedStopId);
      if (stop && isValidCoordinate(stop.latitude, stop.longitude)) {
        if (leafletMapRef.current) {
          try {
            leafletMapRef.current.setView([stop.latitude, stop.longitude], 16, { animate: true });
          } catch {
            // Safe guard
          }
        } else if (googleMapRef.current) {
          googleMapRef.current.panTo({ lat: stop.latitude, lng: stop.longitude });
          googleMapRef.current.setZoom(16);
        }
      }
    }
  }, [selectedTripId, selectedStopId, activeLocations, stops, activeTab]);

  // Camera Actions
  const handleRecenterOnBus = useCallback(() => {
    setIsAutoFollowing(true);
    if (!selectedVehicleLocation || !isValidCoordinate(selectedVehicleLocation.latitude, selectedVehicleLocation.longitude)) {
      return;
    }
    if (leafletMapRef.current) {
      try {
        leafletMapRef.current.setView(
          [selectedVehicleLocation.latitude, selectedVehicleLocation.longitude],
          15,
          { animate: true }
        );
      } catch {
        // Safe guard
      }
    } else if (googleMapRef.current) {
      googleMapRef.current.panTo({
        lat: selectedVehicleLocation.latitude,
        lng: selectedVehicleLocation.longitude,
      });
      googleMapRef.current.setZoom(15);
    }
  }, [selectedVehicleLocation]);

  const handleShowFullRoute = useCallback(() => {
    setIsAutoFollowing(false);
    if (!selectedRouteObj || selectedRouteObj.stops.length === 0) return;

    const validCoords = selectedRouteObj.stops
      .map((rs) => rs.stop || stops.find((s) => s.id === rs.stopId))
      .filter((s): s is Stop => Boolean(s && isValidCoordinate(s.latitude, s.longitude)))
      .map((s) => [s.latitude, s.longitude] as [number, number]);

    if (validCoords.length === 0) return;

    if (leafletMapRef.current && mapContainerRef.current) {
      try {
        leafletMapRef.current.fitBounds(validCoords, {
          padding: [40, 40],
          animate: false,
          maxZoom: 15,
        });
      } catch {
        // Safe guard
      }
    } else if (googleMapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      validCoords.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
      googleMapRef.current.fitBounds(bounds, 40);
    }
  }, [selectedRouteObj, stops]);

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

    if (leafletMapRef.current) {
      try {
        leafletMapRef.current.setView([stop.latitude, stop.longitude], 16, { animate: true });
      } catch {
        // Safe guard
      }
    }
  }, [onSelectStop]);

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
                <th>Est. Arrival</th>
                <th>Landmark / Corridor</th>
                <th>Accessibility</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedTableStops.map(({ stop, sequence, arrivalOffsetMinutes }) => {
                const isSelected = selectedStopId === stop.id;
                const scheduledTime = computeScheduledTime(
                  '07:15',
                  arrivalOffsetMinutes
                );

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
                        {scheduledTime}
                      </span>
                    </td>
                    <td>{stop.description} ({stop.landmark})</td>
                    <td>
                      {stop.isAccessible ? (
                        <span className="badge badge-success">♿ Accessible</span>
                      ) : (
                        <span className="badge badge-neutral">Standard</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleLocateStop(stop)}
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
