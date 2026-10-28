import { describe, it, expect } from 'vitest';
import {
  LatLng,
  haversineM,
  matchToRoute,
  splitAtDistance,
  simplify,
  cumulativeDistances,
  bearingDeg,
  pointAtDistance,
  distanceAlong,
} from '@/lib/route-geometry';

// An L-shaped road: ~1.1 km north, then ~1.1 km east
const road: LatLng[] = [
  [16.40, 80.50],
  [16.41, 80.50],
  [16.41, 80.51],
];

describe('route geometry', () => {
  it('measures distances and bearings sensibly', () => {
    expect(haversineM([16.40, 80.50], [16.41, 80.50])).toBeGreaterThan(1100);
    expect(haversineM([16.40, 80.50], [16.41, 80.50])).toBeLessThan(1115);
    expect(Math.round(bearingDeg([16.40, 80.50], [16.41, 80.50]))).toBe(0);
    expect(Math.round(bearingDeg([16.41, 80.50], [16.41, 80.51]))).toBe(90);
  });

  it('snaps a GPS fix that is a few metres off the road onto the road', () => {
    const m = matchToRoute({ latitude: 16.405, longitude: 80.5002, accuracyMeters: 10, speedKmH: 30, heading: 2 }, road);
    expect(m.status).toBe('on_route');
    expect(m.matched![1]).toBeCloseTo(80.50, 5);
    expect(m.offsetM!).toBeLessThan(25);
    expect(m.alongM!).toBeGreaterThan(500);
  });

  it('does not snap a bus that is genuinely off the planned route', () => {
    const m = matchToRoute({ latitude: 16.405, longitude: 80.505, accuracyMeters: 10 }, road);
    expect(m.status).toBe('off_route');
    expect(m.matched).toBeUndefined();
    expect(m.offsetM!).toBeGreaterThan(400);
  });

  it('refuses to match observations with poor accuracy', () => {
    const m = matchToRoute({ latitude: 16.405, longitude: 80.5, accuracyMeters: 250 }, road);
    expect(m.status).toBe('low_accuracy');
  });

  it('rejects a segment the moving bus is travelling against', () => {
    // On the north-bound leg but heading south at speed
    const m = matchToRoute({ latitude: 16.405, longitude: 80.5001, accuracyMeters: 10, speedKmH: 40, heading: 180 }, road);
    expect(m.status).toBe('off_route');
  });

  it('reports no_route when there is no planned geometry', () => {
    expect(matchToRoute({ latitude: 16.4, longitude: 80.5, accuracyMeters: 5 }, undefined).status).toBe('no_route');
  });

  it('uses previous progress to pick the right pass on a road used twice', () => {
    // Out and back along the same road
    const outAndBack: LatLng[] = [[16.40, 80.50], [16.42, 80.50], [16.40, 80.5001]];
    const obs = { latitude: 16.401, longitude: 80.50005, accuracyMeters: 10 };
    expect(matchToRoute(obs, outAndBack).status).toBe('ambiguous');
    const total = cumulativeDistances(outAndBack).at(-1)!;
    const late = matchToRoute(obs, outAndBack, total - 200);
    expect(late.status).toBe('on_route');
    expect(late.alongM!).toBeGreaterThan(total / 2);
  });

  it('splits the route at the bus position into travelled and remaining parts', () => {
    const [done, left] = splitAtDistance(road, 1500);
    expect(done.at(-1)).toEqual(left[0]);
    const doneLen = cumulativeDistances(done).at(-1)!;
    expect(doneLen).toBeCloseTo(1500, -1);
    expect(left.at(-1)).toEqual(road.at(-1));
  });

  it('simplifies collinear points without moving the shape', () => {
    const dense: LatLng[] = Array.from({ length: 50 }, (_, i) => [16.40 + i * 0.0002, 80.50] as LatLng);
    const s = simplify(dense, 5);
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual(dense[0]);
    expect(s[1]).toEqual(dense[49]);
  });
});

describe('positions along a route', () => {
  it('pointAtDistance walks the road, turning the corner rather than cutting it', () => {
    const corner = pointAtDistance(road, cumulativeDistances(road)[1]);
    expect(corner[0]).toBeCloseTo(16.41, 6);
    expect(corner[1]).toBeCloseTo(80.50, 6);
    const pastCorner = pointAtDistance(road, cumulativeDistances(road)[1] + 500);
    expect(pastCorner[0]).toBeCloseTo(16.41, 6);
    expect(pastCorner[1]).toBeGreaterThan(80.50);
  });

  it('distanceAlong orders stops by their position on the road', () => {
    const a = distanceAlong([16.405, 80.5001], road).alongM;
    const b = distanceAlong([16.4101, 80.505], road).alongM;
    expect(a).toBeLessThan(b);
  });
});
