/**
 * findBestWindow — the core recommendation engine (§0.6 of the implementation plan).
 *
 * Given a merged half-hourly series, finds the contiguous run of `D` slots that minimises
 * a weighted combination of normalised cost and normalised CO₂.
 */
import type { MergedSlot, Recommendation } from '@energysaver/schema';

export interface BestWindowInput {
  slots: MergedSlot[];
  applianceId: string;
  powerKw: number;
  /** Duration in 30-min slots (D = ceil(runHours / 0.5)) */
  runSlots: number;
  /** 0 = cheapest-only, 1 = greenest-only, 0.5 = balanced */
  weight: number;
  /** Evening peak baseline window for the "saving vs baseline" headline. Default 17:00–20:00 UTC. */
  baselineStartHhMm?: string;
  baselineEndHhMm?: string;
}

interface WindowSummary {
  startIndex: number;
  costGbp: number;
  co2Kg: number;
}

const ENERGY_PER_SLOT_KWH = 0.5; // 30-min period

export function findBestWindow(input: BestWindowInput): Recommendation {
  const {
    slots,
    applianceId,
    powerKw,
    runSlots,
    weight,
    baselineStartHhMm = '17:00',
    baselineEndHhMm = '20:00',
  } = input;

  const energyKwh = powerKw * ENERGY_PER_SLOT_KWH;
  const horizon = slots.length;

  // Slide a window of width `runSlots` across the available horizon
  const windows: WindowSummary[] = [];
  for (let s = 0; s + runSlots <= horizon; s++) {
    let costP = 0;
    let co2Grams = 0;
    for (let t = s; t < s + runSlots; t++) {
      const slot = slots[t];
      if (!slot) continue; // guard for noUncheckedIndexedAccess
      costP += energyKwh * slot.priceP;
      co2Grams += energyKwh * slot.intensityForecast;
    }
    windows.push({ startIndex: s, costGbp: costP / 100, co2Kg: co2Grams / 1000 });
  }

  if (windows.length === 0) {
    throw new Error('No valid windows in the forecast horizon for the given run duration.');
  }

  // Normalise cost and co2 to [0,1] across all windows
  const costs = windows.map((w) => w.costGbp);
  const co2s = windows.map((w) => w.co2Kg);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minCo2 = Math.min(...co2s);
  const maxCo2 = Math.max(...co2s);
  const costRange = maxCost - minCost || 1; // avoid divide-by-zero
  const co2Range = maxCo2 - minCo2 || 1;

  let bestScore = Infinity;
  let bestWindow: WindowSummary = windows[0]!;
  let cheapestWindow: WindowSummary = windows[0]!;
  let greenestWindow: WindowSummary = windows[0]!;

  for (const w of windows) {
    const normCost = (w.costGbp - minCost) / costRange;
    const normCo2 = (w.co2Kg - minCo2) / co2Range;
    const score = weight * normCo2 + (1 - weight) * normCost;

    if (score < bestScore) {
      bestScore = score;
      bestWindow = w;
    }
    if (w.costGbp < cheapestWindow.costGbp) cheapestWindow = w;
    if (w.co2Kg < greenestWindow.co2Kg) greenestWindow = w;
  }

  // Compute baseline (evening peak window)
  const baselineSlots = slots.filter((s) => {
    const hhmm = new Date(s.from).toISOString().slice(11, 16);
    return hhmm >= baselineStartHhMm && hhmm < baselineEndHhMm;
  });

  // Use up to `runSlots` baseline slots starting from the first peak slot
  const baselineCostGbp = baselineSlots.slice(0, runSlots).reduce((acc, s) => {
    return acc + energyKwh * s.priceP / 100;
  }, 0);
  const baselineCo2Kg = baselineSlots.slice(0, runSlots).reduce((acc, s) => {
    return acc + energyKwh * s.intensityForecast / 1000;
  }, 0);

  const savingGbp = Math.max(0, baselineCostGbp - bestWindow.costGbp);
  const savingCo2Kg = Math.max(0, baselineCo2Kg - bestWindow.co2Kg);
  const alreadyOptimal = savingGbp === 0 && savingCo2Kg === 0;

  const hasEstimatedPrices = slots
    .slice(bestWindow.startIndex, bestWindow.startIndex + runSlots)
    .some((s) => s.priceEstimated);

  function slotTime(index: number, offset: number): string {
    const s = slots[index + offset];
    return s ? s.from : '';
  }

  return {
    applianceId,
    powerKw,
    runSlots,
    weight,
    recommendedStart: slotTime(bestWindow.startIndex, 0),
    recommendedEnd: slotTime(bestWindow.startIndex, runSlots - 1),
    recommendedCostGbp: bestWindow.costGbp,
    recommendedCo2Kg: bestWindow.co2Kg,
    cheapestStart: slotTime(cheapestWindow.startIndex, 0),
    cheapestEnd: slotTime(cheapestWindow.startIndex, runSlots - 1),
    cheapestCostGbp: cheapestWindow.costGbp,
    cheapestCo2Kg: cheapestWindow.co2Kg,
    greenestStart: slotTime(greenestWindow.startIndex, 0),
    greenestEnd: slotTime(greenestWindow.startIndex, runSlots - 1),
    greenestCostGbp: greenestWindow.costGbp,
    greenestCo2Kg: greenestWindow.co2Kg,
    baselineCostGbp,
    baselineCo2Kg,
    savingGbp,
    savingCo2Kg,
    alreadyOptimal,
    hasEstimatedPrices,
  };
}
