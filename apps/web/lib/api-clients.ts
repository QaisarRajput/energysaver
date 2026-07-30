/**
 * Fetch clients for live external APIs.
 * All responses are Zod-validated at the boundary; malformed records are skipped.
 * Both clients are safe for client-side fetch (no server-only imports).
 */
import { z } from 'zod';
import { CarbonForecastSlotSchema, AgileRateSchema } from '@energysaver/schema';
import type { CarbonForecastSlot, AgileRate } from '@energysaver/schema';
import { siteConfig } from '../config/site';

// ---- Carbon Intensity API ------------------------------------------------

const CarbonApiSlotSchema = z.object({
  from: z.string(),
  to: z.string(),
  intensity: z.object({
    forecast: z.number(),
    index: z.string(),
  }),
});

const CarbonApiResponseSchema = z.object({
  data: z.array(CarbonApiSlotSchema),
});

/** Fetch 48h national carbon intensity forecast. Degrades to [] on any error. */
export async function getCarbonForecast(postcode?: string): Promise<CarbonForecastSlot[]> {
  const now = new Date().toISOString().slice(0, 16) + 'Z';
  const base = siteConfig.data.carbonApiBase;

  const url = postcode
    ? `${base}/regional/intensity/${now}/fw48h/postcode/${encodeURIComponent(postcode)}`
    : `${base}/intensity/${now}/fw48h`;

  let raw: unknown;
  try {
    const res = await fetch(url, { next: { revalidate: 600 } } as RequestInit);
    if (!res.ok) throw new Error(`Carbon API ${res.status}`);
    raw = await res.json();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[getCarbonForecast] fetch failed:', err);
    return [];
  }

  // Regional endpoint wraps data differently
  const data: unknown[] = extractCarbonData(raw, !!postcode);
  const valid: CarbonForecastSlot[] = [];

  for (const item of data) {
    const slot = CarbonApiSlotSchema.safeParse(item);
    if (!slot.success) continue;
    const mapped = CarbonForecastSlotSchema.safeParse({
      from: slot.data.from,
      to: slot.data.to,
      intensityForecast: slot.data.intensity.forecast,
      intensityIndex: slot.data.intensity.index,
    });
    if (mapped.success) valid.push(mapped.data);
  }

  return valid;
}

function extractCarbonData(raw: unknown, regional: boolean): unknown[] {
  if (typeof raw !== 'object' || raw === null) return [];
  // National: { data: [...] }
  // Regional: { data: { data: [...] } } (nested)
  if (regional) {
    const outer = (raw as Record<string, unknown>)['data'];
    if (typeof outer === 'object' && outer !== null && 'data' in outer) {
      const inner = (outer as Record<string, unknown>)['data'];
      return Array.isArray(inner) ? inner : [];
    }
    return [];
  }
  const national = CarbonApiResponseSchema.safeParse(raw);
  return national.success ? national.data.data : [];
}

// ---- Octopus Agile API ---------------------------------------------------

const OctopusResponseSchema = z.object({
  results: z.array(
    z.object({
      value_inc_vat: z.number(),
      valid_from: z.string(),
      valid_to: z.string(),
    }),
  ),
});

/**
 * Fetch half-hourly Agile unit rates for a GSP letter and time window.
 * Falls back to [] on CORS error or any other failure (the caller degrades to TOU preset).
 */
export async function getAgileRates(
  gspLetter: string,
  from: string,
  to: string,
): Promise<AgileRate[]> {
  const base = siteConfig.data.octopusApiBase;
  const product = siteConfig.data.agileProductCode;
  const tariffCode = `E-1R-${product}-${gspLetter}`;
  const url = `${base}/v1/products/${product}/electricity-tariffs/${tariffCode}/standard-unit-rates/?period_from=${encodeURIComponent(from)}&period_to=${encodeURIComponent(to)}`;

  let raw: unknown;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Octopus API ${res.status}`);
    raw = await res.json();
  } catch (err) {
    // ponytail: CORS or network failure → caller falls back to TOU preset and marks slots estimated
    // eslint-disable-next-line no-console
    console.warn('[getAgileRates] fetch failed (expected if CORS blocked):', err);
    return [];
  }

  const parsed = OctopusResponseSchema.safeParse(raw);
  if (!parsed.success) return [];

  const valid: AgileRate[] = [];
  for (const r of parsed.data.results) {
    const mapped = AgileRateSchema.safeParse({
      validFrom: r.valid_from,
      validTo: r.valid_to,
      valueIncVat: r.value_inc_vat,
    });
    if (mapped.success) valid.push(mapped.data);
  }
  return valid;
}
