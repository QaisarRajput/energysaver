import { z } from 'zod';

export const ApplianceSchema = z.object({
  id: z.string(), // stable slug, e.g. 'tumble-dryer'
  name: z.string(),
  category: z.string(), // e.g. 'laundry', 'ev', 'kitchen'
  powerKw: z.number().positive(),
  defaultRunHours: z.number().positive(),
  description: z.string().optional(),
  affiliateProductUrl: z.string().url().optional(),
  contentHash: z.string(),
});

export type Appliance = z.infer<typeof ApplianceSchema>;
