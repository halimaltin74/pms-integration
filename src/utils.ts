import { randomUUID } from 'crypto';
import { BedType } from './types/canonical';

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export const logger = {
  warn: (message: string, context?: unknown): void => {
    const ctx = context ? ` | context: ${JSON.stringify(context)}` : '';
    console.warn(`[PMS-WARN] ${message}${ctx}`);
  },
  error: (message: string, context?: unknown): void => {
    const ctx = context ? ` | context: ${JSON.stringify(context)}` : '';
    console.error(`[PMS-ERROR] ${message}${ctx}`);
  },
};

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generates a stable-ish prefixed ID. In production you'd persist a mapping;
 * here we use UUIDs so tests can at least assert on the prefix format.
 */
export function generateId(pmsSource: string): string {
  return `${pmsSource}_${randomUUID()}`;
}

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

/**
 * Calculates a 0–1 completeness score.
 * @param populated  Number of "meaningful" fields that were actually filled from source data.
 * @param total      Total number of scoreable fields.
 */
export function calcConfidence(populated: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((populated / total) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Bed type normalisation
// ---------------------------------------------------------------------------

// OTA bed type codes used by Opera / other GDS-connected systems.
// https://opentravel.org/wp-content/uploads/2009/09/OTA_CodeTable2010B.pdf  (Table OTA_BedTypeCodes)
const OTA_BED_CODES: Record<string, BedType> = {
  '1': 'bunk',
  '2': 'bunk',
  '3': 'double',
  '4': 'king',
  '5': 'queen',
  '6': 'sofa',
  '7': 'sofa',
  '8': 'twin',
  '9': 'twin',
  '10': 'single',
  '14': 'double',
  '15': 'king',
  '16': 'queen',
};

const FREE_TEXT_BED_MAP: Record<string, BedType> = {
  single: 'single',
  double: 'double',
  twin: 'twin',
  king: 'king',
  'king size': 'king',
  queen: 'queen',
  'queen size': 'queen',
  bunk: 'bunk',
  sofa: 'sofa',
  'sofa bed': 'sofa',
  'pull-out': 'sofa',
};

export function normaliseBedType(raw: string | number | undefined | null): BedType {
  if (raw == null) return 'unknown';
  const str = String(raw).trim();

  // Try OTA numeric code first
  if (OTA_BED_CODES[str]) return OTA_BED_CODES[str];

  // Try free-text normalisation (case-insensitive)
  const lower = str.toLowerCase();
  for (const [key, value] of Object.entries(FREE_TEXT_BED_MAP)) {
    if (lower.includes(key)) return value;
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/** Coerces a value that might be a numeric string to a proper number. */
export function toInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

/** Returns first non-empty string from a localised object or plain string. */
export function pickLocalised(
  value: unknown,
  preferredLocale = 'en-US',
): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const map = value as Record<string, unknown>;
    if (typeof map[preferredLocale] === 'string') return map[preferredLocale] as string;
    // Fallback: first defined string value
    for (const v of Object.values(map)) {
      if (typeof v === 'string' && v.trim()) return v;
    }
  }
  return '';
}
