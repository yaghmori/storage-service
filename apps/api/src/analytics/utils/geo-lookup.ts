import {
  countryCentroid,
  resolveMacroRegion,
  type MacroRegion,
} from './geo-regions';

export type GeoLookupResult = {
  countryCode: string | null;
  regionCode: MacroRegion | null;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
};

type GeoIpLiteLookup = {
  country?: string;
  region?: string;
  city?: string;
  ll?: [number, number];
};

type GeoIpLiteModule = {
  lookup: (ip: string) => GeoIpLiteLookup | null;
};

let geoipModule: GeoIpLiteModule | null | undefined;

function isGeoIpEnabled(): boolean {
  const raw = (process.env.GEOIP_ENABLED ?? 'true').toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off';
}

function loadGeoIp(): GeoIpLiteModule | null {
  if (geoipModule !== undefined) return geoipModule;
  if (!isGeoIpEnabled()) {
    geoipModule = null;
    return null;
  }
  try {
    // Optional dependency — keep worker images lean when GEOIP_ENABLED=false.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    geoipModule = require('geoip-lite') as GeoIpLiteModule;
  } catch {
    geoipModule = null;
  }
  return geoipModule;
}

function headerValue(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0]?.trim() || undefined;
  if (typeof raw === 'string') return raw.trim() || undefined;
  return undefined;
}

function normalizeCountry(code: string | undefined | null): string | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  if (upper.length !== 2 || upper === 'XX' || upper === 'T1') return null;
  return upper;
}

function toCoordString(value: number | undefined | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(6);
}

/**
 * Resolve geo from Cloudflare country header and/or MaxMind geoip-lite.
 */
export function resolveDownloadGeo(input: {
  ipAddress?: string | null;
  headers?: Record<string, string | string[] | undefined>;
}): GeoLookupResult {
  const cfCountry = normalizeCountry(
    headerValue(input.headers, 'cf-ipcountry'),
  );

  let countryCode: string | null = cfCountry;
  let city: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;

  const ip = input.ipAddress?.trim();
  if (ip) {
    const geoip = loadGeoIp();
    const hit = geoip?.lookup(ip);
    if (hit) {
      if (!countryCode) {
        countryCode = normalizeCountry(hit.country);
      }
      city = hit.city?.trim() || null;
      if (Array.isArray(hit.ll) && hit.ll.length === 2) {
        latitude = hit.ll[0];
        longitude = hit.ll[1];
      }
    }
  }

  if (countryCode && (latitude == null || longitude == null)) {
    const centroid = countryCentroid(countryCode);
    if (centroid) {
      latitude = latitude ?? centroid.latitude;
      longitude = longitude ?? centroid.longitude;
    }
  }

  const regionCode = countryCode
    ? resolveMacroRegion(countryCode, longitude)
    : null;

  return {
    countryCode,
    regionCode,
    city,
    latitude: toCoordString(latitude),
    longitude: toCoordString(longitude),
  };
}
