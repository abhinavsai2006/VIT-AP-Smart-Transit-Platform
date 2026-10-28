import { Route, RouteGeometry, RouteStop, Stop, Trip } from '@/types/transit';
import routesSource from '../../data/bus-routes-2026-27.json';
import geocodes from '../../data/stop-geocodes.json';
import routeGeometries from '../../data/route-geometries.json';

/**
 * Official 2026-27 morning bus timetable, transcribed from "2026-27 Bus Routes.pdf"
 * (see data/bus-routes-2026-27.json for the transcription and its review notes).
 *
 * Only what the timetable states is produced here: route numbers, ordered pickup points and
 * printed times. Bus/driver assignments, seat counts and live positions are NOT in the timetable
 * and are left unassigned. Stop coordinates come from data/stop-geocodes.json
 * (scripts/geocode-stops.mjs) and are marked unverified; unresolved stops get NaN coordinates.
 * Road paths come from data/route-geometries.json (scripts/build-route-geometry.mjs).
 */

export const TIMETABLE_SOURCE = '2026-27 Bus Routes.pdf';

// Changes whenever the timetable, geocodes or road geometry are regenerated, so cached
// in-memory stores (dev hot reload) know to re-seed
export const TIMETABLE_DATA_VERSION = [
  TIMETABLE_SOURCE,
  (geocodes as { updatedAt?: string }).updatedAt ?? '',
  (routeGeometries as { updatedAt?: string }).updatedAt ?? '',
].join('|');

export interface RawPickupPoint {
  name: string;
  time: string; // as printed, e.g. "7.00 AM", "7:30AM"
}

export interface RawRouteSchedule {
  routeNumber: string; // e.g. "VV-1", "GV-1", "TV-1"
  region: 'Vijayawada' | 'Guntur' | 'Tenali';
  points: RawPickupPoint[];
}

export const OFFICIAL_SCHEDULES_DATA: RawRouteSchedule[] = routesSource.routes.map((r) => ({
  routeNumber: r.routeNumber,
  region: r.region as RawRouteSchedule['region'],
  points: r.points.map(([name, time]) => ({ name, time })),
}));

export const TIMETABLE_REVIEW_NOTES: string[] = routesSource.reviewNotes;

/**
 * Normalizes a printed time to "HH:MM AM" without changing its value
 */
export function normalizeTime(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/(\d{1,2})[.:](\d{2})\s*(AM|PM)/i);
  if (!match) return cleaned;
  return `${match[1].padStart(2, '0')}:${match[2]} ${match[3].toUpperCase()}`;
}

/**
 * Converts a printed time to minutes from midnight; NaN if it cannot be parsed
 */
export function timeToMinutes(timeStr: string): number {
  const match = normalizeTime(timeStr).match(/(\d{2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return NaN;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const mer = match[3].toUpperCase();
  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function to24h(timeStr: string): string {
  const mins = timeToMinutes(timeStr);
  if (Number.isNaN(mins)) return '';
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/** Collapses repeated whitespace from the PDF layout without altering spelling */
export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export function isCampusPoint(name: string): boolean {
  return /^vit\s*-?\s*ap/i.test(name.trim());
}

export interface ScheduleAnomaly {
  routeNumber: string;
  pointName: string;
  time: string;
  previousPointName: string;
  previousTime: string;
  description: string;
}

/**
 * Flags unparseable times and times that go backwards along a route
 */
export function findScheduleAmbiguities(): ScheduleAnomaly[] {
  const anomalies: ScheduleAnomaly[] = [];
  OFFICIAL_SCHEDULES_DATA.forEach((route) => {
    route.points.forEach((pt, i) => {
      const cur = timeToMinutes(pt.time);
      const prev = i > 0 ? route.points[i - 1] : null;
      if (Number.isNaN(cur)) {
        anomalies.push({
          routeNumber: route.routeNumber,
          pointName: pt.name,
          time: pt.time,
          previousPointName: prev?.name ?? '',
          previousTime: prev?.time ?? '',
          description: `Unparseable time "${pt.time}" on Route ${route.routeNumber} at "${pt.name}"`,
        });
      } else if (prev && cur < timeToMinutes(prev.time)) {
        anomalies.push({
          routeNumber: route.routeNumber,
          pointName: pt.name,
          time: pt.time,
          previousPointName: prev.name,
          previousTime: prev.time,
          description: `Time regression on Route ${route.routeNumber}: "${pt.name}" (${pt.time}) is earlier than preceding stop "${prev.name}" (${prev.time})`,
        });
      }
    });
  });
  return anomalies;
}

interface GeocodeEntry {
  status: 'surveyed' | 'geocoded_unverified' | 'unresolved';
  latitude?: number;
  longitude?: number;
  matchedName?: string;
  source?: string; // for surveyed entries: who/how it was verified
}

const GEOCODES = (geocodes as { entries: Record<string, GeocodeEntry> }).entries;

interface GeometryEntry extends Omit<RouteGeometry, 'coordinates'> {
  coordinates?: number[][];
}

const GEOMETRIES = (routeGeometries as { routes: Record<string, GeometryEntry> }).routes;

function geometryFor(routeId: string): RouteGeometry {
  const g = GEOMETRIES[routeId];
  if (!g) return { status: 'unavailable', coordinates: [], reason: 'Road path not computed yet' };
  return {
    status: g.status,
    coordinates: (g.coordinates ?? []).map(([lat, lng]) => [lat, lng] as [number, number]),
    distanceM: g.distanceM,
    provider: g.provider,
    profile: g.profile,
    excludedStops: g.excludedStops,
    problems: g.problems,
    reason: g.reason,
  };
}

// Campus reference point (main gate area, Inavolu). Approximate: replace with a surveyed point.
const CAMPUS_STOP: Stop = {
  id: 'stop-vit-ap-campus',
  code: 'VIT-AP',
  name: 'VIT-AP Campus',
  description: 'Destination of all morning routes (8:45 AM arrival)',
  landmark: 'Inavolu, Amaravati',
  latitude: 16.4963,
  longitude: 80.4996,
  coordinateStatus: 'reference',
  coordinateSource: 'Approximate campus reference point; confirm with a surveyed bus-bay position',
  isAccessible: true,
  createdAt: '2026-06-01T00:00:00Z',
};

function routeSlug(routeNumber: string): string {
  return routeNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function istDateString(d = new Date()): string {
  return new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

/**
 * Builds Stop, Route and (unassigned) Trip records for every route in the official timetable.
 * IDs are derived from route number + sequence so repeated imports are idempotent.
 * Pickup points are not merged across routes by name, because generic names
 * ("Market", "Bus Stand", "Varadhi") can refer to different places.
 */
export function buildOfficialTransitData(): {
  stops: Stop[];
  routes: Route[];
  trips: Trip[];
} {
  const stops = new Map<string, Stop>([[CAMPUS_STOP.id, CAMPUS_STOP]]);
  const routes: Route[] = [];
  const trips: Trip[] = [];
  const travelDate = istDateString();

  OFFICIAL_SCHEDULES_DATA.forEach((raw) => {
    const slug = routeSlug(raw.routeNumber);
    const routeId = `route-${slug}`;
    const firstMins = timeToMinutes(raw.points[0].time);
    const geometry = geometryFor(routeId);
    // Geocodes the route check found inconsistent with the stop order (e.g. a same-named place elsewhere)
    const rejected = new Map(
      (geometry.excludedStops ?? []).filter((x) => x.reason.startsWith('location rejected')).map((x) => [x.seq, x.reason])
    );

    const routeStops: RouteStop[] = raw.points.map((pt, i) => {
      const seq = i + 1;
      const name = cleanName(pt.name);
      let stop: Stop;

      if (isCampusPoint(name)) {
        stop = CAMPUS_STOP;
      } else {
        const id = `stop-${slug}-${String(seq).padStart(2, '0')}`;
        const geo = GEOCODES[`${raw.region}|${name}`];
        const resolved =
          geo !== undefined && geo.status !== 'unresolved' && geo.latitude !== undefined && geo.longitude !== undefined &&
          (geo.status === 'surveyed' || !rejected.has(seq));
        const surveyed = resolved && geo.status === 'surveyed';
        stop = {
          id,
          code: `${raw.routeNumber}/${seq}`,
          name,
          description: `Route ${raw.routeNumber} pickup point ${seq} (${raw.region})`,
          landmark: raw.region,
          latitude: resolved ? geo.latitude! : NaN,
          longitude: resolved ? geo.longitude! : NaN,
          coordinateStatus: surveyed ? 'surveyed' : resolved ? 'geocoded_unverified' : 'unresolved',
          coordinateSource: surveyed
            ? geo.source || 'Surveyed position'
            : resolved
              ? `OpenStreetMap Nominatim match "${geo.matchedName}" (not yet verified)`
              : rejected.has(seq)
                ? `Geocode rejected (${rejected.get(seq)})`
                : 'No verified location yet',
          isAccessible: false,
          createdAt: '2026-06-01T00:00:00Z',
        };
        stops.set(id, stop);
      }

      const mins = timeToMinutes(pt.time);
      const offset = Number.isNaN(mins) || Number.isNaN(firstMins) ? 0 : Math.max(0, mins - firstMins);
      return {
        id: `rs-${slug}-${seq}`,
        routeId,
        stopId: stop.id,
        stopSequence: seq,
        arrivalOffsetMinutes: offset,
        departureOffsetMinutes: offset,
        scheduledTime: pt.time.trim(),
        stop,
      };
    });

    const origin = routeStops[0];
    const dest = routeStops[routeStops.length - 1];
    const lastPoint = raw.points[raw.points.length - 1];
    const viaNote = cleanName(lastPoint.name).match(/via .+$/i)?.[0];

    const route: Route = {
      id: routeId,
      routeNumber: raw.routeNumber,
      routeName: `${raw.routeNumber} — ${origin.stop!.name} to VIT-AP Campus`,
      description: `${raw.region} morning route, ${routeStops.length - 1} pickup points${viaNote ? `, ${viaNote}` : ''}. Arrives ${lastPoint.time.trim()}.`,
      originStopId: origin.stopId,
      destinationStopId: dest.stopId,
      status: 'active',
      estimatedDurationMinutes: dest.arrivalOffsetMinutes,
      // Road distance only when the path covers every stop; otherwise it would understate the route
      distanceKm: geometry.distanceM && geometry.status === 'ok' ? Number((geometry.distanceM / 1000).toFixed(1)) : 0,
      fareAmount: 0,
      stops: routeStops,
      region: raw.region,
      source: TIMETABLE_SOURCE,
      geometry,
    };
    routes.push(route);

    // Timetabled service only: no bus, crew or seat capacity is stated in the timetable
    const tripId = `trip-${slug}-morning`;
    trips.push({
      id: tripId,
      routeId,
      busId: '',
      driverId: '',
      conductorId: '',
      travelDate,
      departureTime: to24h(raw.points[0].time),
      arrivalTime: to24h(lastPoint.time),
      status: 'scheduled',
      totalSeats: 0,
      bookedSeats: 0,
      operationalNotes: 'Bus and crew not yet assigned for this timetabled service.',
      route,
      stops: routeStops.map((rs) => ({
        id: `ts-${slug}-${rs.stopSequence}`,
        tripId,
        stopId: rs.stopId,
        scheduledArrival: to24h(rs.scheduledTime!),
        scheduledDeparture: to24h(rs.scheduledTime!),
        status: 'pending',
        stop: rs.stop,
      })),
    });
  });

  return { stops: Array.from(stops.values()), routes, trips };
}
