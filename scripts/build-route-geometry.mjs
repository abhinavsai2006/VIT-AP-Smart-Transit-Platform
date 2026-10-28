// Builds road-following geometry for each timetable route using OSRM and caches it in
// data/route-geometries.json. Run after geocoding; the app never calls the router at request time.
//
// Usage: node scripts/build-route-geometry.mjs [--refresh]
//   OSRM_BASE_URL  router to use (default: public OSRM demo server, light non-commercial use only)
//
// The OSRM "driving" profile is a car profile: it does not know bus-specific restrictions
// (height/weight limits, bus-only lanes). Treat the output as the planned road path between the
// timetable's stops, to be checked against the actual bus routes by the transport office.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { haversineM, simplify } from '../src/lib/route-geometry.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const routesData = JSON.parse(readFileSync(join(root, 'data', 'bus-routes-2026-27.json'), 'utf8'));
const geocodes = JSON.parse(readFileSync(join(root, 'data', 'stop-geocodes.json'), 'utf8')).entries;
const outPath = join(root, 'data', 'route-geometries.json');
const cache = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : { routes: {} };

const OSRM = (process.env.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
const PROFILE = 'driving';
const refresh = process.argv.includes('--refresh');

// Must match CAMPUS_STOP in src/lib/official-schedules.ts
const CAMPUS = [16.4963, 80.4996];
const MAX_SNAP_M = 1000; // a stop further than this from any road is treated as a bad location
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (n) => n.replace(/\s+/g, ' ').trim();
const isCampus = (n) => /^vit\s*-?\s*ap/i.test(n.trim());

function minutes(t) {
  const m = t.match(/(\d{1,2})[.:](\d{2})\s*(AM|PM)/i);
  if (!m) return NaN;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
}

function locatedStops(route) {
  return route.points.map(([name, time], i) => {
    const seq = i + 1;
    const mins = minutes(time);
    if (isCampus(name)) return { seq, name: clean(name), at: CAMPUS, mins, campus: true };
    const g = geocodes[`${route.region}|${clean(name)}`];
    const ok = g && g.status !== 'unresolved' && Number.isFinite(g.latitude) && Number.isFinite(g.longitude);
    return { seq, name: clean(name), at: ok ? [g.latitude, g.longitude] : null, mins };
  });
}

// A geocode that sends the route on a large detour relative to its neighbours is almost
// certainly the wrong place (e.g. a same-named landmark in another town)
function findOutliers(stops) {
  const located = stops.filter((s) => s.at);
  const out = new Map();
  for (let i = 1; i < located.length - 1; i++) {
    const [p, c, n] = [located[i - 1], located[i], located[i + 1]];
    const direct = haversineM(p.at, n.at);
    const via = haversineM(p.at, c.at) + haversineM(c.at, n.at);
    if (via - direct > 4000 && via / Math.max(direct, 300) > 2.5) {
      out.set(c.seq, `detour of ${((via - direct) / 1000).toFixed(1)} km between stops ${p.seq} and ${n.seq}`);
    }
  }
  // First stop far beyond the second relative to the rest of the route
  if (located.length >= 3) {
    const [a, b] = located;
    const rest = haversineM(b.at, located.at(-1).at);
    if (haversineM(a.at, b.at) > Math.max(15000, rest)) out.set(a.seq, 'first stop far from the rest of the route');
  }

  // Timetable consistency: the printed minutes between two stops bound how far apart they can be
  // (generous 60 km/h straight-line plus 3 km slack). A stop inconsistent with both located
  // neighbours, or a first stop inconsistent with a consistent second stop, is misplaced.
  const tooFar = (p, q) => haversineM(p.at, q.at) > Math.abs(q.mins - p.mins) * 1000 + 3000;
  const timed = located.filter((s) => !out.has(s.seq) && Number.isFinite(s.mins));
  for (let i = 0; i < timed.length; i++) {
    const [p, c, n] = [timed[i - 1], timed[i], timed[i + 1]];
    if (c.campus) continue;
    const badPrev = p ? tooFar(p, c) : null;
    const badNext = n && !n.campus ? tooFar(c, n) : null;
    // The campus leg can't confirm or refute a stop (it's always ~45-90 min), so the last pickup
    // point is judged on its previous neighbour alone
    if (badPrev && (badNext || !n || n.campus)) out.set(c.seq, `${(haversineM(p.at, c.at) / 1000).toFixed(1)} km from stop ${p.seq}, unreachable in the printed ${c.mins - p.mins} min`);
    else if (!p && badNext && timed[i + 2] && !tooFar(n, timed[i + 2])) {
      out.set(c.seq, `${(haversineM(c.at, n.at) / 1000).toFixed(1)} km from stop ${n.seq}, unreachable in the printed ${n.mins - c.mins} min`);
    }
  }
  return out;
}

async function osrmRoute(points) {
  const coords = points.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
  const url = `${OSRM}/route/v1/${PROFILE}/${coords}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url, { headers: { 'User-Agent': 'VIT-AP-Smart-Transit/1.0 (route geometry build)' } });
  if (res.status === 429) throw new Error('rate limited');
  const json = await res.json();
  if (json.code !== 'Ok' || !json.routes?.[0]) throw new Error(`OSRM ${json.code}: ${json.message || 'no route'}`);
  return json;
}

let changed = 0;
for (const route of routesData.routes) {
  const id = `route-${route.routeNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const stops = locatedStops(route);
  const outliers = findOutliers(stops);
  const used = stops.filter((s) => s.at && !outliers.has(s.seq));
  const inputKey = JSON.stringify(used.map((s) => [s.seq, s.at]));

  if (!refresh && cache.routes[id]?.inputKey === inputKey) continue;
  changed++;

  const excluded = [
    ...stops.filter((s) => !s.at).map((s) => ({ seq: s.seq, name: s.name, reason: 'no location' })),
    ...[...outliers].map(([seq, reason]) => ({ seq, name: stops[seq - 1].name, reason: `location rejected: ${reason}` })),
  ].sort((a, b) => a.seq - b.seq);

  const base = { routeNumber: route.routeNumber, inputKey, provider: OSRM, profile: PROFILE, fetchedAt: new Date().toISOString(), excludedStops: excluded };

  if (used.length < 2 || used.at(-1).seq !== stops.length) {
    cache.routes[id] = { ...base, status: 'unavailable', reason: 'Fewer than two located stops' };
    console.log(`${route.routeNumber.padEnd(6)} unavailable (located ${used.length}/${stops.length})`);
    continue;
  }

  try {
    const json = await osrmRoute(used.map((s) => s.at));
    await sleep(1100);
    const r = json.routes[0];
    // GeoJSON is [lng, lat]; convert to [lat, lng]
    const full = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const coordinates = simplify(full, 3).map(([lat, lng]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))]);

    const snaps = json.waypoints.map((w, i) => ({ seq: used[i].seq, snapM: Math.round(w.distance) }));
    const badSnaps = snaps.filter((s) => s.snapM > MAX_SNAP_M);
    const legs = r.legs.map((leg, i) => {
      const straight = haversineM(used[i].at, used[i + 1].at);
      const ratio = straight > 0 ? leg.distance / straight : 1;
      return {
        fromSeq: used[i].seq,
        toSeq: used[i + 1].seq,
        distanceM: Math.round(leg.distance),
        durationS: Math.round(leg.duration),
        // Road distance much longer than the straight line usually means a misplaced stop
        suspect: leg.distance > 3000 && ratio > 3,
      };
    });

    // Geometry must stay in the region and contain no impossible jumps between vertices
    const inRegion = coordinates.every(([lat, lng]) => lat > 15.9 && lat < 17.0 && lng > 80.0 && lng < 81.2);
    const maxJump = Math.max(...coordinates.slice(1).map((p, i) => haversineM(coordinates[i], p)));

    const problems = [];
    if (!inRegion) problems.push('geometry leaves the Vijayawada–Guntur–Tenali region');
    if (maxJump > 5000) problems.push(`gap of ${(maxJump / 1000).toFixed(1)} km between geometry points`);
    if (badSnaps.length) problems.push(`stops ${badSnaps.map((s) => s.seq).join(', ')} are >${MAX_SNAP_M} m from any road`);
    legs.filter((l) => l.suspect).forEach((l) => problems.push(`leg ${l.fromSeq}→${l.toSeq} is ${(l.distanceM / 1000).toFixed(1)} km by road, >3× straight-line`));

    const status = !inRegion || maxJump > 5000 ? 'unavailable' : excluded.length || problems.length ? 'partial' : 'ok';
    cache.routes[id] = {
      ...base,
      status,
      distanceM: Math.round(r.distance),
      durationS: Math.round(r.duration),
      routedStops: used.map((s) => s.seq),
      legs,
      snaps,
      problems,
      coordinates: status === 'unavailable' ? [] : coordinates,
    };
    console.log(`${route.routeNumber.padEnd(6)} ${status.padEnd(11)} ${(r.distance / 1000).toFixed(1)} km, ${coordinates.length} pts, routed ${used.length}/${stops.length} stops${problems.length ? ` — ${problems.join('; ')}` : ''}`);
  } catch (err) {
    cache.routes[id] = { ...base, status: 'unavailable', reason: String(err.message || err) };
    console.log(`${route.routeNumber.padEnd(6)} unavailable — ${err.message || err}`);
    await sleep(3000);
  }
}

cache.attribution = 'Route geometry © OpenStreetMap contributors (ODbL), computed with OSRM';
cache.updatedAt = new Date().toISOString();
writeFileSync(outPath, JSON.stringify(cache, null, 1));
const all = Object.values(cache.routes);
console.log(`\n${changed} routes (re)built. ok: ${all.filter((r) => r.status === 'ok').length}, partial: ${all.filter((r) => r.status === 'partial').length}, unavailable: ${all.filter((r) => r.status === 'unavailable').length}`);
