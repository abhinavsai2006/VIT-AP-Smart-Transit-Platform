// Geocodes pickup points from data/bus-routes-2026-27.json using OpenStreetMap Nominatim.
// Results are candidates only (status "geocoded_unverified") and must be reviewed before being
// treated as surveyed positions. Unmatched or implausible results are recorded as "unresolved"
// so the app never invents a coordinate.
//
// Usage: node scripts/geocode-stops.mjs [--retry-unresolved]
// Respects the Nominatim usage policy: 1 request/second, identifying User-Agent, results cached.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const routesPath = join(root, 'data', 'bus-routes-2026-27.json');
const outPath = join(root, 'data', 'stop-geocodes.json');

// VIT-AP campus reference used only for a plausibility radius check
const CAMPUS = { lat: 16.4963, lng: 80.4996 };
const MAX_KM_FROM_CAMPUS = 50;
// Bounding box covering Vijayawada, Guntur, Tenali and Amaravati (lng1,lat1,lng2,lat2)
const VIEWBOX = '80.20,16.85,81.00,16.05';

const retryUnresolved = process.argv.includes('--retry-unresolved');
const data = JSON.parse(readFileSync(routesPath, 'utf8'));
const cache = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : { entries: {} };

const isCampus = (name) => /^vit\s*-?\s*ap/i.test(name.trim());
const key = (region, name) => `${region}|${name.replace(/\s+/g, ' ').trim()}`;

function km(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&bounded=1&viewbox=${VIEWBOX}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'VIT-AP-Smart-Transit/1.0 (route stop geocoding, one-off import)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json[0];
}

const todo = [];
for (const r of data.routes) {
  for (const [name] of r.points) {
    if (isCampus(name)) continue;
    const k = key(r.region, name);
    const existing = cache.entries[k];
    if (existing && !(retryUnresolved && existing.status === 'unresolved')) continue;
    if (!todo.some((t) => t.k === k)) todo.push({ k, name: name.replace(/\s+/g, ' ').trim(), region: r.region });
  }
}

console.log(`${todo.length} pickup points to geocode`);
for (const [i, t] of todo.entries()) {
  const queries = [`${t.name}, ${t.region}, Andhra Pradesh`, `${t.name}, Andhra Pradesh`];
  let entry = { status: 'unresolved', query: queries[0] };
  for (const q of queries) {
    try {
      const hit = await search(q);
      await sleep(1100);
      if (!hit) continue;
      const pt = { lat: Number(hit.lat), lng: Number(hit.lon) };
      const dist = km(pt, CAMPUS);
      if (dist > MAX_KM_FROM_CAMPUS) {
        entry = { status: 'unresolved', query: q, rejected: `match ${dist.toFixed(1)} km from campus: ${hit.display_name}` };
        continue;
      }
      entry = {
        status: 'geocoded_unverified',
        query: q,
        latitude: Number(pt.lat.toFixed(6)),
        longitude: Number(pt.lng.toFixed(6)),
        matchedName: hit.display_name,
        osmType: hit.osm_type,
        osmId: hit.osm_id,
      };
      break;
    } catch (err) {
      entry = { status: 'unresolved', query: q, error: String(err) };
      await sleep(2000);
    }
  }
  cache.entries[t.k] = entry;
  console.log(`[${i + 1}/${todo.length}] ${entry.status.padEnd(20)} ${t.k}`);
  if (i % 10 === 0) writeFileSync(outPath, JSON.stringify(cache, null, 2));
}

cache.generatedBy = 'scripts/geocode-stops.mjs (OpenStreetMap Nominatim)';
cache.attribution = 'Geocoding data © OpenStreetMap contributors, ODbL';
cache.updatedAt = new Date().toISOString();
writeFileSync(outPath, JSON.stringify(cache, null, 2));
const vals = Object.values(cache.entries);
console.log(`done: ${vals.filter((v) => v.status !== 'unresolved').length} geocoded (unverified), ${vals.filter((v) => v.status === 'unresolved').length} unresolved`);
