import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/trips/[id]/location/route';
import { store, updateLiveLocation, getLiveLocationForTrip, LocationRejectedError } from '@/lib/db/store';
import { busIdForDeviceToken } from '@/lib/gps-auth';
import { cumulativeDistances, pointAtDistance } from '@/lib/route-geometry';

const KEY = 'test-device-key-0123456789abcdef';
const TRIP = 'trip-vv-7-morning';

function post(tripId: string, body: unknown, key: string | null = KEY) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  const req = new NextRequest(`http://localhost/api/trips/${tripId}/location`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: tripId }) });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('GPS device authentication', () => {
  it('maps a valid bearer key to its bus and rejects anything else', () => {
    const keys = `bus-01:${KEY},bus-02:another-key-0123456789abcdef`;
    expect(busIdForDeviceToken(`Bearer ${KEY}`, keys)).toBe('bus-01');
    expect(busIdForDeviceToken('Bearer wrong', keys)).toBeNull();
    expect(busIdForDeviceToken(null, keys)).toBeNull();
    expect(busIdForDeviceToken(`Bearer ${KEY}`, '')).toBeNull();
    // Keys shorter than 24 characters are ignored as too weak
    expect(busIdForDeviceToken('Bearer short', 'bus-01:short')).toBeNull();
  });
});

describe('GPS ingestion endpoint', () => {
  let road: [number, number][];

  beforeAll(() => {
    process.env.GPS_DEVICE_KEYS = `bus-01:${KEY}`;
    road = store.routes.get('route-vv-7')!.geometry!.coordinates;
  });

  it('rejects requests without a valid device key', async () => {
    const res = await post(TRIP, { latitude: 16.5, longitude: 80.6, accuracyMeters: 10 }, null);
    expect(res.status).toBe(401);
  });

  it('rejects a bus that is not assigned to the trip (timetable trips start unassigned)', async () => {
    const res = await post(TRIP, { latitude: 16.5, longitude: 80.6, accuracyMeters: 10 });
    expect(res.status).toBe(403);
  });

  it('accepts a report from the assigned bus and matches it onto the planned road', async () => {
    store.trips.get(TRIP)!.busId = 'bus-01';
    expect(road.length).toBeGreaterThan(10);
    const onRoad = pointAtDistance(road, cumulativeDistances(road).at(-1)! / 2);
    // ~15 m off the road line, as real GPS noise would be
    const res = await post(TRIP, { latitude: onRoad[0] + 0.00013, longitude: onRoad[1], accuracyMeters: 12 });
    expect(res.status).toBe(200);
    const { location } = await res.json();
    expect(location.latitude).toBeCloseTo(onRoad[0] + 0.00013, 6); // raw observation preserved
    expect(location.matchStatus).toBe('on_route');
    expect(location.routeOffsetM).toBeLessThan(30);
    expect(location.alongRouteM).toBeGreaterThan(0);
    expect(location.speedKmH).toBeNull(); // not reported, not invented (NaN serialises as null)
  });

  it('reports an off-route bus at its real position instead of snapping it', async () => {
    await wait(1050); // per-bus rate limit
    const res = await post(TRIP, { latitude: 16.62, longitude: 80.95, accuracyMeters: 10 });
    expect(res.status).toBe(200);
    const { location } = await res.json();
    expect(location.matchStatus).toBe('off_route');
    expect(location.matchedLatitude).toBeUndefined();
    expect(location.latitude).toBe(16.62);
  });

  it('validates coordinates, speed, heading and timestamps', async () => {
    await wait(1050);
    expect((await post(TRIP, { latitude: 200, longitude: 80, accuracyMeters: 5 })).status).toBe(422);
    await wait(1050);
    expect((await post(TRIP, { latitude: 16.5, longitude: 80.6 })).status).toBe(400);
    await wait(1050);
    expect((await post(TRIP, { latitude: 16.5, longitude: 80.6, accuracyMeters: 5, speedKmH: 900 })).status).toBe(422);
    await wait(1050);
    const future = new Date(Date.now() + 5 * 60_000).toISOString();
    expect((await post(TRIP, { latitude: 16.5, longitude: 80.6, accuracyMeters: 5, recordedAt: future })).status).toBe(422);
  });

  it('rate-limits a device to one report per second', async () => {
    await wait(1050);
    expect((await post(TRIP, { latitude: 16.5, longitude: 80.6, accuracyMeters: 5 })).status).toBe(200);
    expect((await post(TRIP, { latitude: 16.5, longitude: 80.6, accuracyMeters: 5 })).status).toBe(429);
  });
});

describe('GPS ordering and staleness', () => {
  it('never lets an older report overwrite a newer position', async () => {
    const base = { tripId: 'trip-order-test', busId: 'bus-x', driverId: '', accuracyMeters: 8 };
    await updateLiveLocation({ ...base, latitude: 16.5, longitude: 80.6, recordedAt: new Date().toISOString() });
    const older = new Date(Date.now() - 30_000).toISOString();
    await updateLiveLocation({ ...base, latitude: 16.4, longitude: 80.5, recordedAt: older });
    const current = await getLiveLocationForTrip('trip-order-test');
    expect(current?.latitude).toBe(16.5);
  });

  it('rejects null-island and non-finite coordinates', async () => {
    const base = { tripId: 'trip-bad', busId: 'bus-x', driverId: '', accuracyMeters: 8 };
    await expect(updateLiveLocation({ ...base, latitude: 0, longitude: 0 })).rejects.toBeInstanceOf(LocationRejectedError);
    await expect(updateLiveLocation({ ...base, latitude: NaN, longitude: 80 })).rejects.toBeInstanceOf(LocationRejectedError);
  });
});
