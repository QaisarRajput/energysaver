import { z } from 'zod';

// Matches the Carbon Intensity API response shape
const IntensityIndexSchema = z.enum(['very low', 'low', 'moderate', 'high', 'very high']);

export const CarbonForecastSlotSchema = z.object({
  from: z.string(), // ISO UTC e.g. '2024-01-01T00:00Z'
  to: z.string(),
  intensityForecast: z.number().nonnegative(), // gCO₂/kWh
  intensityIndex: IntensityIndexSchema,
});

export const AgileRateSchema = z.object({
  validFrom: z.string(), // ISO UTC
  validTo: z.string(),
  valueIncVat: z.number(), // pence/kWh, can be negative
});

// A joined slot with both carbon intensity and price
export const MergedSlotSchema = z.object({
  from: z.string(), // ISO UTC — the canonical key
  to: z.string(),
  intensityForecast: z.number().nonnegative(),
  intensityIndex: IntensityIndexSchema,
  priceP: z.number(), // pence/kWh
  priceEstimated: z.boolean(), // true if price came from TOU fallback, not live Agile
});

export const RecommendationSchema = z.object({
  applianceId: z.string(),
  powerKw: z.number().positive(),
  runSlots: z.number().int().positive(), // number of 30-min slots
  weight: z.number().min(0).max(1), // 0=cheapest, 1=greenest
  // Recommended window
  recommendedStart: z.string(),
  recommendedEnd: z.string(),
  recommendedCostGbp: z.number(),
  recommendedCo2Kg: z.number(),
  // Pure-cheapest window
  cheapestStart: z.string(),
  cheapestEnd: z.string(),
  cheapestCostGbp: z.number(),
  cheapestCo2Kg: z.number(),
  // Pure-greenest window
  greenestStart: z.string(),
  greenestEnd: z.string(),
  greenestCostGbp: z.number(),
  greenestCo2Kg: z.number(),
  // vs baseline evening peak
  baselineCostGbp: z.number(),
  baselineCo2Kg: z.number(),
  savingGbp: z.number(),
  savingCo2Kg: z.number(),
  alreadyOptimal: z.boolean(),
  hasEstimatedPrices: z.boolean(),
});

export type CarbonForecastSlot = z.infer<typeof CarbonForecastSlotSchema>;
export type AgileRate = z.infer<typeof AgileRateSchema>;
export type MergedSlot = z.infer<typeof MergedSlotSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type IntensityIndex = z.infer<typeof IntensityIndexSchema>;
