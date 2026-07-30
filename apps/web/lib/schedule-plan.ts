/**
 * schedule-plan.ts — constraint-aware multi-appliance scheduler.
 *
 * Algorithm:
 * 1. Sort appliances by power (highest first) — they have fewer valid low-carbon windows.
 * 2. For each appliance, find the best non-overlapping window using the same scoring
 *    approach as findBestWindow, but excluding already-occupied slots.
 * 3. If no non-overlapping window exists, fall back to best available and mark overlaps: true.
 *
 * Time complexity: O(A × S) where A = appliances, S = slots (≤ 96). Synchronous and trivial.
 */
import type { Appliance, MergedSlot, TariffPreset, DayPlanResult, Assignment } from '@energysaver/schema';
import type { ScheduleItem } from '@energysaver/schema';

function windowCo2(slots: MergedSlot[], startIdx: number, runSlots: number, powerKw: number): number {
  let sum = 0;
  for (let i = startIdx; i < startIdx + runSlots; i++) {
    const s = slots[i];
    if (!s) break;
    sum += (s.intensityForecast / 1000) * powerKw * 0.5; // kg CO₂
  }
  return sum;
}

function windowCostGbp(slots: MergedSlot[], startIdx: number, runSlots: number, powerKw: number): number {
  let sum = 0;
  for (let i = startIdx; i < startIdx + runSlots; i++) {
    const s = slots[i];
    if (!s) break;
    sum += (s.priceP / 100) * powerKw * 0.5;
  }
  return sum;
}

/** Mark slots occupied; returns updated occupancy array */
function markOccupied(occupied: boolean[], startIdx: number, runSlots: number): boolean[] {
  const next = [...occupied];
  for (let i = startIdx; i < startIdx + runSlots; i++) {
    if (i < next.length) next[i] = true;
  }
  return next;
}

function isOverlapping(occupied: boolean[], startIdx: number, runSlots: number): boolean {
  for (let i = startIdx; i < startIdx + runSlots; i++) {
    if (occupied[i]) return true;
  }
  return false;
}

/** Compute HH:MM constraint as a slot index (0–95) */
function hhmmToSlotIdx(hhMm: string, slots: MergedSlot[]): number {
  const [hh, mm] = hhMm.split(':').map(Number);
  const baseDate = new Date(slots[0]!.from);
  baseDate.setUTCHours(hh!, mm!, 0, 0);
  // Find slot closest to this time
  const targetMs = baseDate.getTime();
  let best = 0;
  let bestDiff = Infinity;
  slots.forEach((s, i) => {
    const diff = Math.abs(new Date(s.from).getTime() - targetMs);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  });
  return best;
}

export interface PlanInput {
  items: (ScheduleItem & { appliance: Appliance })[];
  slots: MergedSlot[];
  tariff?: TariffPreset | null;
}

export function schedulePlan({ items, slots }: PlanInput): DayPlanResult {
  if (!slots.length || !items.length) {
    return { assignments: [], totalCostGbp: 0, totalCo2Kg: 0, totalSavingGbp: 0, totalSavingCo2Kg: 0 };
  }

  // Sort by power descending
  const sorted = [...items].sort((a, b) => b.appliance.powerKw - a.appliance.powerKw);

  let occupied: boolean[] = new Array(slots.length).fill(false);
  const assignments: Assignment[] = [];

  for (const item of sorted) {
    const { appliance, weight, earliestStartHhMm, latestEndHhMm } = item;
    const runSlots = Math.max(1, Math.round(appliance.defaultRunHours * 2)); // 2 slots/hour

    // Determine search bounds
    const earliest = earliestStartHhMm ? hhmmToSlotIdx(earliestStartHhMm, slots) : 0;
    const latestEnd = latestEndHhMm ? hhmmToSlotIdx(latestEndHhMm, slots) : slots.length;
    const maxStart = Math.max(earliest, latestEnd - runSlots);

    // Compute min/max ranges for normalisation
    const candidates: { idx: number; cost: number; co2: number }[] = [];
    for (let i = earliest; i <= Math.min(maxStart, slots.length - runSlots); i++) {
      candidates.push({
        idx: i,
        cost: windowCostGbp(slots, i, runSlots, appliance.powerKw),
        co2: windowCo2(slots, i, runSlots, appliance.powerKw),
      });
    }
    if (!candidates.length) continue;

    const minCost = Math.min(...candidates.map((c) => c.cost));
    const maxCost = Math.max(...candidates.map((c) => c.cost));
    const minCo2 = Math.min(...candidates.map((c) => c.co2));
    const maxCo2 = Math.max(...candidates.map((c) => c.co2));
    const costRange = maxCost - minCost || 1;
    const co2Range = maxCo2 - minCo2 || 1;

    // Score each candidate
    const scored = candidates.map((c) => ({
      ...c,
      score: (1 - weight) * ((c.cost - minCost) / costRange) + weight * ((c.co2 - minCo2) / co2Range),
      overlap: isOverlapping(occupied, c.idx, runSlots),
    }));

    // First try non-overlapping
    const nonOverlap = scored.filter((s) => !s.overlap).sort((a, b) => a.score - b.score);
    const best = nonOverlap[0] ?? scored.sort((a, b) => a.score - b.score)[0];
    if (!best) continue;

    // Baseline: peak window (5–8 pm = slots around index 34–40 from midnight)
    const peakIdx = scored.reduce((best, c) => {
      const hr = new Date(slots[c.idx]!.from).getUTCHours();
      return hr >= 17 && hr < 20 ? (c.score > (scored[best]?.score ?? -Infinity) ? c.idx : best) : best;
    }, 0);
    const baselineCost = windowCostGbp(slots, peakIdx, runSlots, appliance.powerKw);
    const baselineCo2 = windowCo2(slots, peakIdx, runSlots, appliance.powerKw);

    const startSlot = slots[best.idx];
    const endSlot = slots[Math.min(best.idx + runSlots, slots.length - 1)];
    if (!startSlot || !endSlot) continue;

    assignments.push({
      applianceId: appliance.id,
      start: startSlot.from,
      end: endSlot.to,
      costGbp: best.cost,
      co2Kg: best.co2,
      savingGbp: Math.max(0, baselineCost - best.cost),
      savingCo2Kg: Math.max(0, baselineCo2 - best.co2),
      overlaps: best.overlap,
    });

    occupied = markOccupied(occupied, best.idx, runSlots);
  }

  const totalCostGbp = assignments.reduce((s, a) => s + a.costGbp, 0);
  const totalCo2Kg = assignments.reduce((s, a) => s + a.co2Kg, 0);
  const totalSavingGbp = assignments.reduce((s, a) => s + a.savingGbp, 0);
  const totalSavingCo2Kg = assignments.reduce((s, a) => s + a.savingCo2Kg, 0);

  return { assignments, totalCostGbp, totalCo2Kg, totalSavingGbp, totalSavingCo2Kg };
}
