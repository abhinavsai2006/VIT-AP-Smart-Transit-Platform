'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Map as LeafletMap, LayerGroup as LeafletLayerGroup } from 'leaflet';
import { Route, Stop, GPSLocation, Bus } from '@/types/transit';
import { Compass, AlertTriangle, Crosshair, Maximize2, Radio, RotateCcw, MapPin, Eye } from 'lucide-react';
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
  zoom = 12,
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

  // Leaflet map and layer group references
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const leafletStopsLayerRef = useRef<LeafletLayerGroup | null>(null);
  const leafletRoutesLayerRef = useRef<LeafletLayerGroup | null>(null);
  const leafletVehiclesLayerRef = useRef<LeafletLayerGroup | null>(null);

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

  // Selected vehicle location if available
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

  // Focus Actions
  const focusOnBus = useCallback(() => {
    if (!selectedVehicleLocation || !isValidCoordinate(selectedVehicleLocation.latitude, selectedVehicleLocation.longitude)) {
      return;
    }
    setActiveTab('map');
    if (leafletMapRef.current) {
      try {
        leafletMapRef.current.setView(
          [selectedVehicleLocation.latitude, selectedVehicleLocation.longitude],
          15,
          { animate: true }
        );
      } catch {
        // Safe viewport fallback
      }
    } else if (googleMapRef.current) {
      googleMapRef.current.panTo({
        lat: selectedVehicleLocation.latitude,
        lng: selectedVehicleLocation.longitude,
      });
      googleMapRef.current.setZoom(15);
    }
  }, [selectedVehicleLocation]);

  const focusOnRoute = useCallback(() => {
    if (!selectedRouteObj || selectedRouteObj.stops.length === 0) return;
    setActiveTab('map');

    const validCoords = selectedRouteObj.stops
      .map((rs) => rs.stop || stops.find((s) => s.id === rs.stopId))
      .filter((s): s is Stop => Boolean(s && isValidCoordinate(s.latitude, s.longitude)))
      .map((s) => [s.latitude, s.longitude] as [number, number]);

    if (validCoords.length === 0) return;

    if (leafletMapRef.current && mapContainerRef.current) {
      const container = mapContainerRef.current;
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        try {
          leafletMapRef.current.fitBounds(validCoords, {
            padding: [40, 40],
            animate: false,
            maxZoom: 15,
          });
        } catch {
          // Safe guard
        }
      }
    } else if (googleMapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      validCoords.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
      googleMapRef.current.fitBounds(bounds, 40);
    }
  }, [selectedRouteObj, stops]);

  const focusAllBuses = useCallback(() => {
    setActiveTab('map');
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
      const container = mapContainerRef.current;
      if (container.clientWidth > 0 && container.clientHeight > 0) {
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
    } else if (googleMapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      allCoords.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
      googleMapRef.current.fitBounds(bounds, 30);
    }
  }, [activeLocations, stops]);

  const focusOnStop = useCallback((stop: Stop) => {
    if (!isValidCoordinate(stop.latitude, stop.longitude)) return;
    setActiveTab('map');
    setSelectedItem({
      type: 'stop',
      id: stop.id,
      title: stop.name,
      details: `${stop.description} (${stop.landmark})`,
      status: stop.isAccessible ? 'Wheelchair Accessible' : 'Standard Stop',
      coordinates: [stop.latitude, stop.longitude],
    });
    onSelectStop?.(stop.id);

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
  }, [onSelectStop]);

  const handleClearSelection = useCallback(() => {
    setSelectedItem(null);
    focusAllBuses();
  }, [focusAllBuses]);

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

  // Create Leaflet divIcon for a vehicle with live beacon and speed badge
  const createBusIcon = useCallback((
    L: typeof import('leaflet'),
    isLive: boolean,
    busCode: string,
    speedKmH: number,
    isSelected: boolean
  ) => {
    const safeBusCode = escapeHtml(busCode);
    return L.divIcon({
      className: 'transit-bus-marker',
      html: `
        <div style="
          background: ${isSelected ? '#030712' : '#090d12'};
          color: #ffffff;
          padding: 3px 8px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          box-shadow: ${isSelected ? '0 0 0 3px #3b82f6, 0 6px 16px rgba(0,0,0,0.55)' : '0 4px 14px rgba(0,0,0,0.45)'};
          border: 2px solid ${isLive ? '#3b82f6' : '#94a3b8'};
          cursor: pointer;
          white-space: nowrap;
          transform: ${isSelected ? 'scale(1.08)' : 'scale(1)'};
          transition: all 0.2s ease;
        ">
          <span style="
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: ${isLive ? '#22c55e' : '#f59e0b'};
            box-shadow: 0 0 6px ${isLive ? '#22c55e' : '#f59e0b'};
            display: inline-block;
          "></span>
          <span>${safeBusCode}</span>
          <span style="
            font-size: 10px;
            font-weight: 600;
            color: #94a3b8;
            border-left: 1px solid #334155;
            padding-left: 5px;
          ">${speedKmH}k</span>
        </div>
      `,
      iconSize: [92, 28],
      iconAnchor: [46, 14],
      popupAnchor: [0, -16],
    });
  }, []);

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

    const map = L.map(container, {
      center,
      zoom,
      zoomControl: true,
      fadeAnimation: false,
    });
    leafletMapRef.current = map;

    // Use clean, standard OpenStreetMap tiles - zero API key watermark
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    leafletRoutesLayerRef.current = L.layerGroup().addTo(map);
    leafletStopsLayerRef.current = L.layerGroup().addTo(map);
    leafletVehiclesLayerRef.current = L.layerGroup().addTo(map);

    animFrameIdRef.current = requestAnimationFrame(() => {
      try {
        if (leafletMapRef.current && mapContainerRef.current) {
          leafletMapRef.current.invalidateSize({ animate: false });
        }
      } catch {
        // Safe guard
      }
    });
  }, [center, zoom, cleanupLeafletMap]);

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
    googleMapRef.current = map;
  }, [center, zoom, cleanupGoogleMap]);

  // Update Leaflet map layers
  const updateLeafletLayers = useCallback(async () => {
    const map = leafletMapRef.current;
    if (!map || !mapContainerRef.current) return;

    const L = (await import('leaflet')).default;
    if (!leafletMapRef.current || !mapContainerRef.current) return;

    leafletRoutesLayerRef.current?.clearLayers();
    leafletStopsLayerRef.current?.clearLayers();
    leafletVehiclesLayerRef.current?.clearLayers();

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
          color: isSelected ? '#1c69d4' : '#64748b',
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 0.95 : 0.55,
          dashArray: isSelected ? undefined : '6, 8',
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

    // 3. Render Vehicles with de-clustering
    const coordKeyCounts = new Map<string, number>();

    activeLocations.forEach((loc) => {
      if (!isValidCoordinate(loc.latitude, loc.longitude)) return;

      const isSelected = selectedTripId === loc.tripId;
      const key = `${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`;
      const duplicateIndex = coordKeyCounts.get(key) || 0;
      coordKeyCounts.set(key, duplicateIndex + 1);

      let visualLat = loc.latitude;
      let visualLng = loc.longitude;
      if (duplicateIndex > 0) {
        const angle = (duplicateIndex * 2 * Math.PI) / 6;
        const offset = 0.00035;
        visualLat += Math.cos(angle) * offset;
        visualLng += Math.sin(angle) * offset;
      }

      const busCode = loc.bus?.busCode || 'BUS';
      const marker = L.marker([visualLat, visualLng], {
        icon: createBusIcon(L, loc.isLive, busCode, loc.speedKmH, isSelected),
        zIndexOffset: isSelected ? 2000 : 1000,
      });

      const formattedTime = new Date(loc.timestamp).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
      });

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; min-width: 210px; padding: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 700; color: #1c69d4; text-transform: uppercase;">Vehicle Telemetry</span>
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
          <div style="font-size: 12px; margin-bottom: 6px;">Ground Speed: <strong>${loc.speedKmH} km/h</strong></div>
          <div style="font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 4px;">
            Last Update: ${formattedTime} IST
          </div>
        </div>
      `);

      marker.on('click', () => {
        onSelectTrip?.(loc.tripId);
        setSelectedItem({
          type: 'bus',
          id: loc.tripId,
          title: `Vehicle ${busCode}`,
          details: `Route: ${loc.routeName || 'Scheduled Commuter'} | Reg: ${loc.bus?.registrationNumber || 'AP39'}`,
          status: loc.isLive ? 'Active Telemetry' : 'Signal Stale (>2m)',
          speed: loc.speedKmH,
          lastUpdated: formattedTime,
          coordinates: [loc.latitude, loc.longitude],
        });
        if (leafletMapRef.current) {
          try {
            leafletMapRef.current.setView([visualLat, visualLng], 15, { animate: true });
          } catch {
            // Safe guard
          }
        }
      });

      if (leafletVehiclesLayerRef.current) {
        marker.addTo(leafletVehiclesLayerRef.current);
      }
    });
  }, [
    stops,
    routes,
    selectedRouteId,
    selectedTripId,
    selectedStopId,
    activeLocations,
    createStopIcon,
    createBusIcon,
    onSelectRoute,
    onSelectStop,
    onSelectTrip,
  ]);

  // Update Google Maps markers & polylines
  const updateGoogleLayers = useCallback(() => {
    const map = googleMapRef.current;
    if (!map || !mapContainerRef.current) return;

    googleMarkersRef.current.forEach((m) => m.setMap(null));
    googleMarkersRef.current = [];
    googlePolylinesRef.current.forEach((p) => p.setMap(null));
    googlePolylinesRef.current = [];

    // 1. Render Stops
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

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 180px;">
            <div style="font-size: 10px; font-weight: 700; color: #1c69d4; text-transform: uppercase;">Bus Stop</div>
            <div style="font-size: 14px; font-weight: 700; margin: 2px 0;">${escapeHtml(stop.name)}</div>
            <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">${escapeHtml(stop.description || '')} (${escapeHtml(stop.landmark || '')})</div>
            <div style="font-size: 11px; font-weight: 700; color: #1a2129;">Code: ${escapeHtml(stop.code)}</div>
          </div>
        `,
      });

      marker.addListener('click', () => {
        onSelectStop?.(stop.id);
        infoWindow.open(map, marker);
        setSelectedItem({
          type: 'stop',
          id: stop.id,
          title: stop.name,
          details: `${stop.description} (${stop.landmark})`,
          status: stop.isAccessible ? 'Wheelchair Accessible' : 'Standard Stop',
          coordinates: [stop.latitude, stop.longitude],
        });
      });

      googleMarkersRef.current.push(marker);
    });

    // 2. Render Routes
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
          strokeColor: isSelected ? '#1c69d4' : '#64748b',
          strokeOpacity: isSelected ? 0.95 : 0.6,
          strokeWeight: isSelected ? 5 : 3,
          map,
        });

        polyline.addListener('click', () => {
          onSelectRoute?.(route.id);
        });

        googlePolylinesRef.current.push(polyline);
      }
    });

    // 3. Render Vehicles with de-clustering
    const coordKeyCounts = new Map<string, number>();

    activeLocations.forEach((loc) => {
      if (!isValidCoordinate(loc.latitude, loc.longitude)) return;
      const isSelected = selectedTripId === loc.tripId;

      const key = `${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`;
      const duplicateIndex = coordKeyCounts.get(key) || 0;
      coordKeyCounts.set(key, duplicateIndex + 1);

      let visualLat = loc.latitude;
      let visualLng = loc.longitude;
      if (duplicateIndex > 0) {
        const angle = (duplicateIndex * 2 * Math.PI) / 6;
        const offset = 0.00035;
        visualLat += Math.cos(angle) * offset;
        visualLng += Math.sin(angle) * offset;
      }

      const busPos = { lat: visualLat, lng: visualLng };
      const busCode = loc.bus?.busCode || 'BUS';

      const marker = new google.maps.Marker({
        position: busPos,
        map,
        title: `${busCode} (${loc.speedKmH} km/h)`,
        zIndex: isSelected ? 2000 : 1000,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: isSelected ? 8 : 6,
          rotation: loc.heading || 0,
          fillColor: isSelected ? '#2563eb' : (loc.isLive ? '#1c69d4' : '#64748b'),
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      const formattedTime = new Date(loc.timestamp).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 190px;">
            <div style="font-size: 10px; font-weight: 700; color: #1c69d4; text-transform: uppercase;">Vehicle Telemetry</div>
            <div style="font-size: 15px; font-weight: 800; margin: 2px 0;">${escapeHtml(busCode)} (${escapeHtml(loc.bus?.rawRegistration || 'AP39')})</div>
            <div style="font-size: 12px; margin-bottom: 4px;">Speed: <strong>${loc.speedKmH} km/h</strong></div>
            <div style="font-size: 11px; color: ${loc.isLive ? '#16a34a' : '#b45309'};">Status: <strong>${loc.isLive ? 'Live GPS Feed' : 'Stale Location (>2m)'}</strong></div>
          </div>
        `,
      });

      marker.addListener('click', () => {
        onSelectTrip?.(loc.tripId);
        infoWindow.open(map, marker);
        setSelectedItem({
          type: 'bus',
          id: loc.tripId,
          title: `Vehicle ${busCode}`,
          details: `Route: ${loc.routeName || 'Scheduled Commuter'} | Speed: ${loc.speedKmH} km/h`,
          status: loc.isLive ? 'Active Telemetry' : 'Signal Stale (>2m)',
          speed: loc.speedKmH,
          lastUpdated: formattedTime,
          coordinates: [loc.latitude, loc.longitude],
        });
      });

      googleMarkersRef.current.push(marker);
    });
  }, [stops, routes, selectedRouteId, selectedTripId, selectedStopId, activeLocations, onSelectRoute, onSelectStop, onSelectTrip]);

  // Main Effect: Initializes the Map Engine ONCE on mount
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

  // Layer Update Effect: Decoupled from Map Creation
  useEffect(() => {
    if (activeTab !== 'map') return;

    if (mapProvider === 'leaflet' && leafletMapRef.current) {
      updateLeafletLayers();
    } else if (mapProvider === 'google' && googleMapRef.current) {
      updateGoogleLayers();
    }
  }, [
    activeTab,
    mapProvider,
    stops,
    routes,
    selectedRouteId,
    selectedTripId,
    selectedStopId,
    activeLocations,
    updateLeafletLayers,
    updateGoogleLayers,
  ]);

  // Synchronized Camera Focus: Triggers when selectedTripId or selectedStopId explicitly changes
  useEffect(() => {
    if (activeTab !== 'map') return;

    // Check if selectedTripId changed
    if (selectedTripId && selectedTripId !== prevSelectedTripIdRef.current) {
      prevSelectedTripIdRef.current = selectedTripId;
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
      } else if (selectedRouteId) {
        focusOnRoute();
      }
      return;
    }

    // Check if selectedStopId changed
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
  }, [selectedTripId, selectedStopId, selectedRouteId, activeLocations, stops, activeTab, focusOnRoute]);

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
        </div>

        {/* Action Controls & View Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {activeTab === 'map' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={focusOnBus}
                disabled={!selectedVehicleLocation}
                title={selectedVehicleLocation ? 'Zoom to selected bus position' : 'No bus selected or GPS unavailable'}
                className="btn btn-sm btn-outline-light"
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  opacity: selectedVehicleLocation ? 1 : 0.5,
                  cursor: selectedVehicleLocation ? 'pointer' : 'not-allowed',
                }}
              >
                <Crosshair size={13} />
                <span>Focus Bus</span>
              </button>

              <button
                type="button"
                onClick={focusOnRoute}
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
                <span>Show Full Route</span>
              </button>

              <button
                type="button"
                onClick={focusAllBuses}
                title="Fit map to entire campus transit network"
                className="btn btn-sm btn-outline-light"
                style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Radio size={13} />
                <span>All Buses</span>
              </button>

              <button
                type="button"
                onClick={handleClearSelection}
                title="Reset selection and view overview"
                className="btn btn-sm btn-outline-light"
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                <RotateCcw size={12} />
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
                    onClick={focusOnBus}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Crosshair size={12} />
                    <span>Focus Bus</span>
                  </button>
                )}

                {selectedRouteObj && (
                  <button
                    type="button"
                    onClick={focusOnRoute}
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
          {/* Table Header Filter Toggle */}
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
                        onClick={() => focusOnStop(stop)}
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
