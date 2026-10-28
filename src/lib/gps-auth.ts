import { createHash, timingSafeEqual } from 'node:crypto';

// GPS devices authenticate with a per-bus key from GPS_DEVICE_KEYS ("busId:key,busId:key").
// Server-only: never import this from client components.

const MIN_KEY_LENGTH = 24;

function digest(v: string): Buffer {
  return createHash('sha256').update(v).digest();
}

function parseKeys(raw: string | undefined): { busId: string; keyDigest: Buffer }[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(':');
      return { busId: pair.slice(0, idx).trim(), key: pair.slice(idx + 1).trim() };
    })
    .filter(({ busId, key }) => busId && key.length >= MIN_KEY_LENGTH)
    .map(({ busId, key }) => ({ busId, keyDigest: digest(key) }));
}

/** Returns the bus a bearer token belongs to, or null. Constant-time comparison. */
export function busIdForDeviceToken(authorization: string | null, rawKeys = process.env.GPS_DEVICE_KEYS): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const presented = digest(match[1].trim());
  let found: string | null = null;
  for (const { busId, keyDigest } of parseKeys(rawKeys)) {
    if (timingSafeEqual(presented, keyDigest) && found === null) found = busId;
  }
  return found;
}

// Simple per-bus rate limit: one accepted report per second
const lastReport = new Map<string, number>();
export function allowReport(busId: string, now = Date.now()): boolean {
  const last = lastReport.get(busId) ?? 0;
  if (now - last < 1000) return false;
  lastReport.set(busId, now);
  return true;
}
