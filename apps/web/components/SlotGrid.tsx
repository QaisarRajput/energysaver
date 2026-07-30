'use client';

/**
 * SlotGrid — sortable table of every half-hourly slot.
 * Lazy-loaded. Uses a plain HTML table for now; AG Grid Community can be wired here
 * as a ponytail upgrade when the richer sort/filter/export features are needed.
 *
 * ponytail: plain HTML <table> with client-side sort. Upgrade to AG Grid Community
 * (dynamic import) when CSV export and column pinning are required.
 */
import { useState, useMemo } from 'react';
import type { MergedSlot, Recommendation } from '@energysaver/schema';
import { fmt12hWithDay } from '../lib/format-time';

interface Props {
  slots: MergedSlot[];
  recommendation: Recommendation;
}

type SortKey = 'time' | 'price' | 'carbon';
type SortDir = 'asc' | 'desc';

export function SlotGrid({ slots, recommendation }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    const copy = [...slots];
    copy.sort((a, b) => {
      let diff = 0;
      if (sortKey === 'time') diff = a.from.localeCompare(b.from);
      else if (sortKey === 'price') diff = a.priceP - b.priceP;
      else if (sortKey === 'carbon') diff = a.intensityForecast - b.intensityForecast;
      return sortDir === 'asc' ? diff : -diff;
    });
    return copy;
  }, [slots, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortBtn({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className={`text-left font-medium transition-colors ${active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </button>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
            <th className="px-4 py-3 text-left"><SortBtn col="time" label="Time (local)" /></th>
            <th className="px-4 py-3 text-right"><SortBtn col="price" label="Price (p/kWh)" /></th>
            <th className="px-4 py-3 text-right"><SortBtn col="carbon" label="gCO₂/kWh" /></th>
            <th className="px-4 py-3 text-center text-[var(--text-muted)]">In window</th>
            <th className="px-4 py-3 text-center text-[var(--text-muted)]">Est. price</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((slot) => {
            const inWindow =
              slot.from >= recommendation.recommendedStart &&
              slot.from <= recommendation.recommendedEnd;
            return (
              <tr
                key={slot.from}
                className={`border-b border-[var(--border)] ${inWindow ? 'bg-[rgba(47,191,113,0.06)]' : 'hover:bg-[var(--bg)]'}`}
              >
                <td className="px-4 py-2 font-mono text-xs">
                  {fmt12hWithDay(slot.from)}
                </td>
                <td className="px-4 py-2 font-mono text-right">
                  {slot.priceP.toFixed(1)}
                </td>
                <td className="px-4 py-2 font-mono text-right">
                  {slot.intensityForecast}
                </td>
                <td className="px-4 py-2 text-center">
                  {inWindow ? (
                    <span className="text-[var(--accent)] font-bold" aria-label="In recommended window">✓</span>
                  ) : ''}
                </td>
                <td className="px-4 py-2 text-center text-[var(--text-muted)] text-xs">
                  {slot.priceEstimated ? 'est.' : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
