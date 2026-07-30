'use client';

/**
 * CarbonHeatmapRibbon — pure CSS 48-slot strip coloring each half-hour by intensity index.
 * Fetches live data client-side. No JS chart library — just CSS grid + color tokens.
 */
import { useEffect, useState } from 'react';
import { getCarbonForecast } from '../lib/api-clients';
import type { CarbonForecastSlot, IntensityIndex } from '@energysaver/schema';

const INDEX_CLASSES: Record<IntensityIndex, string> = {
  'very low': 'intensity-very-low',
  low: 'intensity-low',
  moderate: 'intensity-moderate',
  high: 'intensity-high',
  'very high': 'intensity-very-high',
};

const INDEX_LABELS: Record<IntensityIndex, string> = {
  'very low': 'Very Low',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  'very high': 'Very High',
};

interface Props {
  postcode?: string;
}

export function CarbonHeatmapRibbon({ postcode }: Props) {
  const [slots, setSlots] = useState<CarbonForecastSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCarbonForecast(postcode)
      .then(setSlots)
      .finally(() => setLoading(false));
  }, [postcode]);

  if (loading) {
    return (
      <div
        className="h-8 rounded-lg animate-pulse bg-[var(--border)]"
        aria-label="Loading carbon intensity forecast"
        role="status"
      />
    );
  }

  if (slots.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        Carbon intensity data unavailable. Please try again shortly.
      </p>
    );
  }

  return (
    <div>
      {/* Visually-hidden table for accessibility */}
      <table className="sr-only">
        <caption>48-hour carbon intensity forecast</caption>
        <thead>
          <tr>
            <th scope="col">Time (UTC)</th>
            <th scope="col">Intensity (gCO₂/kWh)</th>
            <th scope="col">Level</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <tr key={s.from}>
              <td>{new Date(s.from).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</td>
              <td>{s.intensityForecast}</td>
              <td>{INDEX_LABELS[s.intensityIndex]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Visual ribbon */}
      <div
        className="flex rounded-lg overflow-hidden h-8 w-full"
        aria-hidden="true"
        title="48-hour carbon intensity"
      >
        {slots.map((s) => (
          <div
            key={s.from}
            className={`flex-1 ${INDEX_CLASSES[s.intensityIndex] ?? 'intensity-moderate'}`}
            title={`${new Date(s.from).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })} — ${s.intensityForecast} gCO₂/kWh (${INDEX_LABELS[s.intensityIndex]})`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 text-xs text-[var(--text-muted)]" aria-label="Legend">
        {(['very low', 'low', 'moderate', 'high', 'very high'] as IntensityIndex[]).map((idx) => (
          <span key={idx} className="flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded-sm ${INDEX_CLASSES[idx]}`} aria-hidden="true" />
            {INDEX_LABELS[idx]}
          </span>
        ))}
      </div>
    </div>
  );
}
