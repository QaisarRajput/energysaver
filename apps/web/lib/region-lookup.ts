/**
 * Resolves a postcode outward area (e.g. 'RG41' → 'RG') to its region record.
 * Falls back to undefined if the area is not in the committed data.
 */
import regionsRaw from '../../../data/regions.json';
import { RegionSchema } from '@energysaver/schema';
import type { Region } from '@energysaver/schema';

// Validate at module load (build-time); any bad records are skipped.
const REGIONS: Region[] = (regionsRaw as unknown[]).flatMap((r) => {
  const result = RegionSchema.safeParse(r);
  return result.success ? [result.data] : [];
});

const REGION_MAP = new Map<string, Region>(REGIONS.map((r) => [r.postcodeArea.toUpperCase(), r]));

/**
 * Extracts the outward postcode area from a full or partial postcode.
 * 'RG41 1AB' → 'RG', 'SW1A' → 'SW', 'EH1' → 'EH', etc.
 */
export function extractPostcodeArea(postcode: string): string {
  // Remove spaces, take only letters at the start
  return postcode.trim().replace(/\s+/g, '').replace(/[^A-Za-z].*$/, '').toUpperCase();
}

export function lookupRegion(postcode: string): Region | undefined {
  const area = extractPostcodeArea(postcode);
  return REGION_MAP.get(area);
}
