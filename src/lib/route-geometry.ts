// Geometry helpers for planned road routes and live GPS observations.
// Coordinates are [lat, lng] throughout (Leaflet order).

export type LatLng = [number, number];

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]));
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) - Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

export function isValidLatLng(p: unknown): p is LatLng {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    Math.abs(p[0]) <= 90 &&
    Math.abs(p[1]) <= 180
  );
}

/** Cumulative distance (m) at each vertex of a polyline */
export function cumulativeDistances(line: LatLng[]): number[] {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + haversineM(line[i - 1], line[i]));
  return out;
}

export interface Projection {
  point: LatLng; // closest point on the polyline
  distanceM: number; // from the observation to that point
  segmentIndex: number;
  alongM: number; // distance along the polyline from its start
  segmentBearing: number;
}

/** Closest point on segment a-b using a local equirectangular approximation (fine at segment scale) */
function projectOnSegment(p: LatLng, a: LatLng, b: LatLng): { point: LatLng; t: number } {
  const kx = Math.cos(toRad(p[0]));
  const ax = a[1] * kx, ay = a[0];
  const bx = b[1] * kx, by = b[0];
  const px = p[1] * kx, py = p[0];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], t };
}

/** All per-segment projections of a point onto a polyline */
export function projectAll(p: LatLng, line: LatLng[], cum = cumulativeDistances(line)): Projection[] {
  const out: Projection[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const { point, t } = projectOnSegment(p, line[i], line[i + 1]);
    out.push({
      point,
      distanceM: haversineM(p, point),
      segmentIndex: i,
      alongM: cum[i] + (cum[i + 1] - cum[i]) * t,
      segmentBearing: bearingDeg(line[i], line[i + 1]),
    });
  }
  return out;
}

export interface GpsObservation {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedKmH?: number;
  heading?: number;
}

export type MatchStatus = 'on_route' | 'off_route' | 'low_accuracy' | 'ambiguous' | 'no_route';

export interface RouteMatch {
  status: MatchStatus;
  // Set only when status is 'on_route'
  matched?: LatLng;
  alongM?: number;
  // Distance from the raw observation to the planned route, when a route exists
  offsetM?: number;
}

// Observations worse than this are not matched at all
export const MAX_MATCH_ACCURACY_M = 100;

/**
 * Matches a GPS observation to the bus's assigned planned route (not to arbitrary nearby roads).
 * Candidate segments must be within a tolerance derived from the reported accuracy; among them,
 * those consistent with the previous progress along the route and the direction of travel win.
 * If no candidate qualifies, the raw observation is kept and the reason is reported.
 */
export function matchToRoute(
  obs: GpsObservation,
  line: LatLng[] | undefined,
  previousAlongM?: number
): RouteMatch {
  if (!line || line.length < 2) return { status: 'no_route' };
  const p: LatLng = [obs.latitude, obs.longitude];
  const projections = projectAll(p, line);
  const nearest = projections.reduce((a, b) => (b.distanceM < a.distanceM ? b : a));

  if (!Number.isFinite(obs.accuracyMeters) || obs.accuracyMeters > MAX_MATCH_ACCURACY_M) {
    return { status: 'low_accuracy', offsetM: nearest.distanceM };
  }

  const tolerance = Math.min(75, Math.max(30, 2 * obs.accuracyMeters));
  const moving = (obs.speedKmH ?? 0) >= 8 && Number.isFinite(obs.heading);

  const candidates = projections.filter((c) => {
    if (c.distanceM > tolerance) return false;
    // A moving bus heading the opposite way to this segment is not travelling along it
    if (moving && angleDiffDeg(obs.heading!, c.segmentBearing) > 100) return false;
    return true;
  });

  if (candidates.length === 0) {
    return { status: 'off_route', offsetM: nearest.distanceM };
  }

  // Prefer continuity with the last matched progress; buses don't jump kilometres along the route
  const score = (c: Projection) => {
    const continuity = previousAlongM === undefined ? 0 : Math.max(0, Math.abs(c.alongM - previousAlongM) - 1500) / 10;
    return c.distanceM + continuity;
  };
  const best = candidates.reduce((a, b) => (score(b) < score(a) ? b : a));

  // Two good candidates far apart along the route (a road used twice) with no history to decide
  if (previousAlongM === undefined) {
    const rival = candidates.find((c) => Math.abs(c.alongM - best.alongM) > 1500 && c.distanceM - best.distanceM < 10);
    if (rival) return { status: 'ambiguous', offsetM: best.distanceM };
  }

  return { status: 'on_route', matched: best.point, alongM: best.alongM, offsetM: best.distanceM };
}

/** Splits a polyline at a distance along it: [travelled, remaining], sharing the split point */
export function splitAtDistance(line: LatLng[], alongM: number): [LatLng[], LatLng[]] {
  if (line.length < 2) return [[], line];
  const cum = cumulativeDistances(line);
  const total = cum[cum.length - 1];
  const d = Math.max(0, Math.min(total, alongM));
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < d) i++;
  const segLen = cum[i + 1] - cum[i];
  const t = segLen === 0 ? 0 : (d - cum[i]) / segLen;
  const split: LatLng = [line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t];
  return [[...line.slice(0, i + 1), split], [split, ...line.slice(i + 1)]];
}

/** Douglas–Peucker simplification with a tolerance in metres */
export function simplify(line: LatLng[], toleranceM: number): LatLng[] {
  if (line.length <= 2) return line;
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = haversineM(line[i], projectOnSegment(line[i], line[s], line[e]).point);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > toleranceM) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

/** Point at a distance along a polyline (clamped to its ends) */
export function pointAtDistance(line: LatLng[], alongM: number, cum = cumulativeDistances(line)): LatLng {
  if (line.length === 1) return line[0];
  const d = Math.max(0, Math.min(cum[cum.length - 1], alongM));
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < d) i++;
  const seg = cum[i + 1] - cum[i];
  const t = seg === 0 ? 0 : (d - cum[i]) / seg;
  return [line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t];
}

/** Distance along a polyline of the closest point to p */
export function distanceAlong(p: LatLng, line: LatLng[], cum = cumulativeDistances(line)): { alongM: number; offsetM: number } {
  const best = projectAll(p, line, cum).reduce((a, b) => (b.distanceM < a.distanceM ? b : a));
  return { alongM: best.alongM, offsetM: best.distanceM };
}
