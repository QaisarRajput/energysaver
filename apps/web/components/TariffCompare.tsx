'use client';

/**
 * TariffCompare — compares the best-window cost for each committed TOU preset + Agile.
 * Lazy-loaded. Uses a simple CSS bar chart.
 */
import { useMemo } from 'react';
import type { MergedSlot, Appliance, TariffPreset } from '@energysaver/schema';
import { mergeSlots } from '../lib/merge-slots';
import { findBestWindow } from '../lib/find-best-window';

interface Props {
  slots: MergedSlot[];
  appliance: Appliance;
  allTariffs: TariffPreset[];
}

export function TariffCompare({ slots, appliance, allTariffs }: Props) {
  const results = useMemo(() => {
    return allTariffs.map((tariff) => {
      // Re-merge with no agile rates (all slots will use TOU fallback)
      const reMerged = mergeSlots(
        slots.map((s) => ({
          from: s.from,
          to: s.to,
          intensityForecast: s.intensityForecast,
          intensityIndex: s.intensityIndex,
        })),
        [],
        tariff,
      );
      const runSlots = Math.max(1, Math.ceil(appliance.defaultRunHours / 0.5));
      try {
        const rec = findBestWindow({
          slots: reMerged,
          applianceId: appliance.id,
          powerKw: appliance.powerKw,
          runSlots,
          weight: 0, // cheapest-only for comparison
        });
        return { tariff, costGbp: rec.cheapestCostGbp, start: rec.cheapestStart };
      } catch {
        return { tariff, costGbp: null, start: null };
      }
    });
  }, [slots, appliance, allTariffs]);

  const validResults = results.filter((r): r is typeof r & { costGbp: number } => r.costGbp !== null);
  const maxCost = Math.max(...validResults.map((r) => r.costGbp), 0.01);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        Best-window cost for your {appliance.name} on each tariff (cheapest window, TOU rates).
      </p>
      <ul className="space-y-3" role="list">
        {results.map(({ tariff, costGbp, start }) => (
          <li key={tariff.id}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm font-medium text-[var(--text)]">{tariff.name}</span>
              <span className="text-sm font-mono text-[var(--text-muted)]">
                {costGbp !== null
                  ? `£${costGbp.toFixed(3)} from ${new Date(start!).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}`
                  : 'N/A'}
              </span>
            </div>
            {costGbp !== null && (
              <div className="h-4 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all"
                  style={{ width: `${(costGbp / maxCost) * 100}%` }}
                  role="meter"
                  aria-valuenow={costGbp}
                  aria-valuemin={0}
                  aria-valuemax={maxCost}
                  aria-label={`${tariff.name}: £${costGbp.toFixed(3)}`}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--text-muted)]">
        Lower bar = cheaper. Agile prices (when enabled) may differ — run the calculator with Agile
        selected to see live comparison.
      </p>
    </div>
  );
}
