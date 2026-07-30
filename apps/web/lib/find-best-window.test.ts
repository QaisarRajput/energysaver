/**
 * Self-check: given a known fixture, findBestWindow must return the known-optimal slot.
 * Run via `pnpm vitest run` or `pnpm test`.
 */
import { describe, it, expect } from 'vitest';
import { findBestWindow } from '../lib/find-best-window';
import type { MergedSlot } from '@energysaver/schema';

// 6 half-hourly slots starting at 00:00 UTC on a fixed date.
// Slot indices: 0=00:00, 1=00:30, 2=01:00, 3=01:30, 4=02:00, 5=02:30
// Cheapest slot: index 4 (2p/kWh)
// Greenest slot: index 1 (50 gCO₂/kWh)
// For a 2-slot run at weight=0 (pure cheapest), best window starts at index 4.
// For a 2-slot run at weight=1 (pure greenest), best window starts at index 1.
// For a 2-slot run at weight=0.5 (balanced), best window starts at index 4 (cheapest heavily dominates).

const FIXTURE: MergedSlot[] = [
  { from: '2024-01-15T00:00Z', to: '2024-01-15T00:30Z', intensityForecast: 200, intensityIndex: 'high',     priceP: 30, priceEstimated: false },
  { from: '2024-01-15T00:30Z', to: '2024-01-15T01:00Z', intensityForecast: 50,  intensityIndex: 'very low', priceP: 25, priceEstimated: false },
  { from: '2024-01-15T01:00Z', to: '2024-01-15T01:30Z', intensityForecast: 150, intensityIndex: 'moderate', priceP: 20, priceEstimated: false },
  { from: '2024-01-15T01:30Z', to: '2024-01-15T02:00Z', intensityForecast: 180, intensityIndex: 'high',     priceP: 22, priceEstimated: false },
  { from: '2024-01-15T02:00Z', to: '2024-01-15T02:30Z', intensityForecast: 160, intensityIndex: 'moderate', priceP: 2,  priceEstimated: false }, // cheapest price
  { from: '2024-01-15T02:30Z', to: '2024-01-15T03:00Z', intensityForecast: 170, intensityIndex: 'moderate', priceP: 5,  priceEstimated: false },
];

// 1 kW appliance, 1 slot (30 min) = 0.5 kWh per slot
const INPUT_BASE = {
  applianceId: 'test-appliance',
  powerKw: 1,
  runSlots: 1,
};

describe('findBestWindow', () => {
  it('weight=0 (cheapest): recommends the cheapest slot', () => {
    const result = findBestWindow({ ...INPUT_BASE, slots: FIXTURE, weight: 0 });
    expect(result.recommendedStart).toBe('2024-01-15T02:00Z');
    // 1 kW × 0.5 h × 2p/100 = £0.01
    expect(result.recommendedCostGbp).toBeCloseTo(0.01, 5);
  });

  it('weight=1 (greenest): recommends the greenest slot', () => {
    const result = findBestWindow({ ...INPUT_BASE, slots: FIXTURE, weight: 1 });
    expect(result.recommendedStart).toBe('2024-01-15T00:30Z');
    // 1 kW × 0.5 h × 50 gCO₂ / 1000 = 0.025 kg
    expect(result.recommendedCo2Kg).toBeCloseTo(0.025, 5);
  });

  it('exposes cheapest and greenest independently', () => {
    const result = findBestWindow({ ...INPUT_BASE, slots: FIXTURE, weight: 0.5 });
    expect(result.cheapestStart).toBe('2024-01-15T02:00Z');
    expect(result.greenestStart).toBe('2024-01-15T00:30Z');
  });

  it('alreadyOptimal is true when recommended window matches baseline', () => {
    // Construct a fixture where the only slot is during the baseline window (17:00–20:00)
    const singleSlot: MergedSlot[] = [{
      from: '2024-01-15T17:00Z',
      to: '2024-01-15T17:30Z',
      intensityForecast: 200,
      intensityIndex: 'high',
      priceP: 30,
      priceEstimated: false,
    }];
    const result = findBestWindow({ ...INPUT_BASE, slots: singleSlot, weight: 0.5 });
    expect(result.alreadyOptimal).toBe(true);
    expect(result.savingGbp).toBe(0);
    expect(result.savingCo2Kg).toBe(0);
  });

  it('clamps saving to zero (never negative)', () => {
    // Baseline (17:00–20:00) is always the cheapest/greenest in this fixture
    const slot: MergedSlot[] = [
      { from: '2024-01-15T17:00Z', to: '2024-01-15T17:30Z', intensityForecast: 50, intensityIndex: 'very low', priceP: 2, priceEstimated: false },
      { from: '2024-01-15T18:00Z', to: '2024-01-15T18:30Z', intensityForecast: 300, intensityIndex: 'very high', priceP: 50, priceEstimated: false },
    ];
    const result = findBestWindow({ ...INPUT_BASE, slots: slot, weight: 0 });
    expect(result.savingGbp).toBeGreaterThanOrEqual(0);
  });
});
