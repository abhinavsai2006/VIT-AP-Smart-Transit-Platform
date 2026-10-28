import { describe, it, expect } from 'vitest';
import {
  OFFICIAL_SCHEDULES_DATA,
  buildOfficialTransitData,
  findScheduleAmbiguities,
  timeToMinutes,
  isCampusPoint,
} from '@/lib/official-schedules';

describe('Official 2026-27 timetable import', () => {
  it('contains every route printed in the PDF: VV-1..21, GV-1..20, TV-1..3', () => {
    const expected = [
      ...Array.from({ length: 21 }, (_, i) => `VV-${i + 1}`),
      ...Array.from({ length: 20 }, (_, i) => `GV-${i + 1}`),
      ...Array.from({ length: 3 }, (_, i) => `TV-${i + 1}`),
    ];
    expect(OFFICIAL_SCHEDULES_DATA.map((r) => r.routeNumber)).toEqual(expected);
  });

  it('every route starts at a pickup point, ends at VIT-AP at 8:45 AM, and has parseable times', () => {
    OFFICIAL_SCHEDULES_DATA.forEach((r) => {
      expect(isCampusPoint(r.points[0].name)).toBe(false);
      const last = r.points[r.points.length - 1];
      expect(isCampusPoint(last.name)).toBe(true);
      expect(timeToMinutes(last.time)).toBe(8 * 60 + 45);
      r.points.forEach((p) => expect(Number.isNaN(timeToMinutes(p.time))).toBe(false));
    });
  });

  it('preserves printed spelling and order (spot checks against the PDF)', () => {
    const vv1 = OFFICIAL_SCHEDULES_DATA.find((r) => r.routeNumber === 'VV-1')!;
    expect(vv1.points[7]).toEqual({ name: 'Kankipadu', time: '7:25 AM' });
    const vv2 = OFFICIAL_SCHEDULES_DATA.find((r) => r.routeNumber === 'VV-2')!;
    expect(vv2.points[5].name).toBe('Bharath Pertol Pump');
    const gv18 = OFFICIAL_SCHEDULES_DATA.find((r) => r.routeNumber === 'GV-18')!;
    expect(gv18.points).toHaveLength(15);
    expect(gv18.points[13]).toEqual({ name: 'Mandadam', time: '8:35 AM' });
  });

  it('flags the GV-3 time regression for review instead of silently reordering it', () => {
    const anomalies = findScheduleAmbiguities();
    expect(anomalies.map((a) => `${a.routeNumber}:${a.pointName}`)).toEqual(['GV-3:Brundavan Gardens']);
  });

  it('builds routes with stops in official order and offsets from printed times', () => {
    const { routes } = buildOfficialTransitData();
    expect(routes).toHaveLength(44);
    routes.forEach((route) => {
      const seqs = route.stops.map((s) => s.stopSequence);
      expect(seqs).toEqual(seqs.map((_, i) => i + 1));
      expect(route.destinationStopId).toBe('stop-vit-ap-campus');
    });
    const vv1 = routes.find((r) => r.routeNumber === 'VV-1')!;
    expect(vv1.stops[7].arrivalOffsetMinutes).toBe(25);
    expect(vv1.stops[7].scheduledTime).toBe('7:25 AM');
  });

  it('is idempotent: rebuilding yields identical IDs with no duplicates', () => {
    const a = buildOfficialTransitData();
    const b = buildOfficialTransitData();
    expect(a.stops.map((s) => s.id)).toEqual(b.stops.map((s) => s.id));
    expect(new Set(a.stops.map((s) => s.id)).size).toBe(a.stops.length);
    expect(new Set(a.routes.map((r) => r.id)).size).toBe(44);
    expect(new Set(a.trips.map((t) => t.id)).size).toBe(44);
  });

  it('never invents coordinates: each stop is either geocoded (flagged unverified) or NaN/unresolved', () => {
    const { stops } = buildOfficialTransitData();
    stops.forEach((s) => {
      if (s.coordinateStatus === 'unresolved') {
        expect(Number.isNaN(s.latitude)).toBe(true);
        expect(Number.isNaN(s.longitude)).toBe(true);
      } else {
        expect(['geocoded_unverified', 'reference', 'surveyed']).toContain(s.coordinateStatus);
        expect(Number.isFinite(s.latitude)).toBe(true);
      }
    });
  });

  it('leaves bus, crew and seat data unassigned because the timetable does not state them', () => {
    const { trips } = buildOfficialTransitData();
    trips.forEach((t) => {
      expect(t.busId).toBe('');
      expect(t.driverId).toBe('');
      expect(t.bookedSeats).toBe(0);
      expect(t.totalSeats).toBe(0);
    });
  });
});
