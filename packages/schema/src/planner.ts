import { z } from 'zod';

export const ScheduleItemSchema = z.object({
  applianceId: z.string(),
  weight: z.number().min(0).max(1).default(0.5),
  earliestStartHhMm: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  latestEndHhMm: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const DayPlanSchema = z.object({
  items: z.array(ScheduleItemSchema),
  postcode: z.string().default(''),
  tariffId: z.string().default('flat-standard'),
});

export const AssignmentSchema = z.object({
  applianceId: z.string(),
  start: z.string(),   // ISO UTC
  end: z.string(),
  costGbp: z.number(),
  co2Kg: z.number(),
  savingGbp: z.number(),
  savingCo2Kg: z.number(),
  overlaps: z.boolean().default(false),
});

export const DayPlanResultSchema = z.object({
  assignments: z.array(AssignmentSchema),
  totalCostGbp: z.number(),
  totalCo2Kg: z.number(),
  totalSavingGbp: z.number(),
  totalSavingCo2Kg: z.number(),
});

export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;
export type DayPlan = z.infer<typeof DayPlanSchema>;
export type Assignment = z.infer<typeof AssignmentSchema>;
export type DayPlanResult = z.infer<typeof DayPlanResultSchema>;
