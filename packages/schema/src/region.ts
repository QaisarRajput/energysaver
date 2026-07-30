import { z } from 'zod';

// GSP letters A–P (14 groups used by Octopus Agile)
const GspLetterSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P']);

export const RegionSchema = z.object({
  // Outward postcode area, e.g. 'RG41' → stored as outward prefix e.g. 'RG'
  postcodeArea: z.string(), // e.g. 'RG', 'SW', 'EH'
  gspLetter: GspLetterSchema,
  carbonRegionId: z.number().int().min(1).max(17),
  regionName: z.string(),
  contentHash: z.string(),
});

export type Region = z.infer<typeof RegionSchema>;
export type GspLetter = z.infer<typeof GspLetterSchema>;
