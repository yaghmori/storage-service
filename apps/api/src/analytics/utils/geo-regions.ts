/**
 * Macro regions (R2-style) + ISO country centroids used when only a country
 * code is known (e.g. Cloudflare cf-ipcountry) and geoip-lite is unavailable.
 */

export type MacroRegion =
  | 'WNAM'
  | 'ENAM'
  | 'WEUR'
  | 'EEUR'
  | 'APAC'
  | 'OC'
  | 'ME'
  | 'AF'
  | 'SAM'
  | 'OTHER';

export const MACRO_REGION_LABELS: Record<MacroRegion, string> = {
  WNAM: 'Western North America',
  ENAM: 'Eastern North America',
  WEUR: 'Western Europe',
  EEUR: 'Eastern Europe',
  APAC: 'Asia Pacific',
  OC: 'Oceania',
  ME: 'Middle East',
  AF: 'Africa',
  SAM: 'South America',
  OTHER: 'Other',
};

/** Approximate country centroids [lat, lon]. */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AF: [33.94, 67.71],
  AL: [41.15, 20.17],
  DZ: [28.03, 1.66],
  AR: [-38.42, -63.62],
  AM: [40.07, 45.04],
  AU: [-25.27, 133.78],
  AT: [47.52, 14.55],
  AZ: [40.14, 47.58],
  BH: [26.07, 50.56],
  BD: [23.68, 90.36],
  BY: [53.71, 27.95],
  BE: [50.5, 4.47],
  BO: [-16.29, -63.59],
  BA: [43.92, 17.68],
  BR: [-14.24, -51.93],
  BG: [42.73, 25.49],
  KH: [12.57, 104.99],
  CA: [56.13, -106.35],
  CL: [-35.68, -71.54],
  CN: [35.86, 104.2],
  CO: [4.57, -74.3],
  CR: [9.75, -83.75],
  HR: [45.1, 15.2],
  CZ: [49.82, 15.47],
  DK: [56.26, 9.5],
  EG: [26.82, 30.8],
  EE: [58.6, 25.01],
  ET: [9.15, 40.49],
  FI: [61.92, 25.75],
  FR: [46.23, 2.21],
  GE: [42.32, 43.36],
  DE: [51.17, 10.45],
  GH: [7.95, -1.02],
  GR: [39.07, 21.82],
  HK: [22.4, 114.11],
  HU: [47.16, 19.5],
  IS: [64.96, -19.02],
  IN: [20.59, 78.96],
  ID: [-0.79, 113.92],
  IR: [32.43, 53.69],
  IQ: [33.22, 43.68],
  IE: [53.41, -8.24],
  IL: [31.05, 34.85],
  IT: [41.87, 12.57],
  JP: [36.2, 138.25],
  JO: [30.59, 36.24],
  KZ: [48.02, 66.92],
  KE: [-0.02, 37.91],
  KW: [29.31, 47.48],
  LV: [56.88, 24.6],
  LB: [33.85, 35.86],
  LT: [55.17, 23.88],
  LU: [49.82, 6.13],
  MY: [4.21, 101.98],
  MX: [23.63, -102.55],
  MA: [31.79, -7.09],
  NL: [52.13, 5.29],
  NZ: [-40.9, 174.89],
  NG: [9.08, 8.68],
  NO: [60.47, 8.47],
  OM: [21.51, 55.92],
  PK: [30.38, 69.35],
  PA: [8.54, -80.78],
  PE: [-9.19, -75.02],
  PH: [12.88, 121.77],
  PL: [51.92, 19.15],
  PT: [39.4, -8.22],
  QA: [25.35, 51.18],
  RO: [45.94, 24.97],
  RU: [61.52, 105.32],
  SA: [23.89, 45.08],
  RS: [44.02, 21.01],
  SG: [1.35, 103.82],
  SK: [48.67, 19.7],
  SI: [46.15, 14.99],
  ZA: [-30.56, 22.94],
  KR: [35.91, 127.77],
  ES: [40.46, -3.75],
  SE: [60.13, 18.64],
  CH: [46.82, 8.23],
  TW: [23.7, 120.96],
  TH: [15.87, 100.99],
  TR: [38.96, 35.24],
  UA: [48.38, 31.17],
  AE: [23.42, 53.85],
  GB: [55.38, -3.44],
  US: [37.09, -95.71],
  UY: [-32.52, -55.77],
  UZ: [41.38, 64.59],
  VE: [6.42, -66.59],
  VN: [14.06, 108.28],
};

/**
 * ISO-3166-1 alpha-2 → macro region. US/CA are split by longitude at runtime
 * when lat/lon are available; otherwise they default as below.
 */
const COUNTRY_TO_REGION: Record<string, MacroRegion> = {
  // Western North America default for Pacific-facing / western hemisphere NA
  US: 'WNAM',
  CA: 'WNAM',
  MX: 'WNAM',
  CR: 'WNAM',
  PA: 'WNAM',

  // Western Europe
  GB: 'WEUR',
  IE: 'WEUR',
  FR: 'WEUR',
  DE: 'WEUR',
  NL: 'WEUR',
  BE: 'WEUR',
  LU: 'WEUR',
  AT: 'WEUR',
  CH: 'WEUR',
  IT: 'WEUR',
  ES: 'WEUR',
  PT: 'WEUR',
  DK: 'WEUR',
  SE: 'WEUR',
  NO: 'WEUR',
  FI: 'WEUR',
  IS: 'WEUR',
  GR: 'WEUR',

  // Eastern Europe
  PL: 'EEUR',
  CZ: 'EEUR',
  SK: 'EEUR',
  HU: 'EEUR',
  RO: 'EEUR',
  BG: 'EEUR',
  UA: 'EEUR',
  BY: 'EEUR',
  RU: 'EEUR',
  EE: 'EEUR',
  LV: 'EEUR',
  LT: 'EEUR',
  RS: 'EEUR',
  HR: 'EEUR',
  SI: 'EEUR',
  BA: 'EEUR',
  AL: 'EEUR',
  GE: 'EEUR',
  AM: 'EEUR',
  AZ: 'EEUR',
  KZ: 'EEUR',
  UZ: 'EEUR',

  // Middle East
  TR: 'ME',
  SA: 'ME',
  AE: 'ME',
  QA: 'ME',
  KW: 'ME',
  BH: 'ME',
  OM: 'ME',
  IR: 'ME',
  IQ: 'ME',
  IL: 'ME',
  JO: 'ME',
  LB: 'ME',
  EG: 'ME',

  // Asia Pacific
  CN: 'APAC',
  HK: 'APAC',
  TW: 'APAC',
  JP: 'APAC',
  KR: 'APAC',
  IN: 'APAC',
  PK: 'APAC',
  BD: 'APAC',
  TH: 'APAC',
  VN: 'APAC',
  MY: 'APAC',
  SG: 'APAC',
  ID: 'APAC',
  PH: 'APAC',
  KH: 'APAC',

  // Oceania
  AU: 'OC',
  NZ: 'OC',

  // Africa
  ZA: 'AF',
  NG: 'AF',
  KE: 'AF',
  GH: 'AF',
  MA: 'AF',
  ET: 'AF',
  DZ: 'AF',

  // South America
  BR: 'SAM',
  AR: 'SAM',
  CL: 'SAM',
  CO: 'SAM',
  PE: 'SAM',
  VE: 'SAM',
  BO: 'SAM',
  UY: 'SAM',
};

export function resolveMacroRegion(
  countryCode: string | null | undefined,
  longitude?: number | null,
): MacroRegion {
  if (!countryCode) return 'OTHER';
  const code = countryCode.toUpperCase();

  // Split North America by longitude when available (~100°W).
  if ((code === 'US' || code === 'CA') && typeof longitude === 'number') {
    return longitude < -100 ? 'WNAM' : 'ENAM';
  }

  return COUNTRY_TO_REGION[code] ?? 'OTHER';
}

export function countryCentroid(
  countryCode: string | null | undefined,
): { latitude: number; longitude: number } | null {
  if (!countryCode) return null;
  const pair = COUNTRY_CENTROIDS[countryCode.toUpperCase()];
  if (!pair) return null;
  return { latitude: pair[0], longitude: pair[1] };
}
