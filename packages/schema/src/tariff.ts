import { z } from 'zod';

const TouWindowSchema = z.object({
  label: z.string(), // e.g. 'peak', 'off-peak'
  startHhMm: z.string().regex(/^\d{2}:\d{2}$/), // 'HH:MM' 24h UTC
  endHhMm: z.string().regex(/^\d{2}:\d{2}$/),
  rateP: z.number().nonnegative(), // pence/kWh
});

export const TariffPresetSchema = z.object({
  id: z.string(), // stable slug, e.g. 'economy-7'
  name: z.string(),
  description: z.string(),
  peakRateP: z.number().nonnegative(),
  offPeakRateP: z.number().nonnegative(),
  windows: z.array(TouWindowSchema),
  contentHash: z.string(),
});

export type TariffPreset = z.infer<typeof TariffPresetSchema>;
export type TouWindow = z.infer<typeof TouWindowSchema>;
