'use client';

import { useEffect, useState } from 'react';
import { siteConfig } from '../config/site';
import type { IntensityIndex } from '@energysaver/schema';

interface CurrentIntensity {
  forecast: number;
  index: IntensityIndex;
  from: string;
  to: string;
}

const INDEX_LABELS: Record<IntensityIndex, string> = {
  'very low': 'Very Low',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  'very high': 'Very High',
};

const INDEX_COLORS: Record<IntensityIndex, string> = {
  'very low': 'text-[#2FBF71]',
  low: 'text-[#86EFAC]',
  moderate: 'text-[#FCD34D]',
  high: 'text-[#F97316]',
  'very high': 'text-[#DC2626]',
};

export function CurrentIntensityWidget() {
  const [data, setData] = useState<CurrentIntensity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${siteConfig.data.carbonApiBase}/intensity`)
      .then((r) => r.json())
      .then((json: unknown) => {
        if (
          typeof json === 'object' &&
          json !== null &&
          'data' in json &&
          Array.isArray((json as Record<string, unknown>)['data'])
        ) {
          const slot = ((json as Record<string, unknown>)['data'] as unknown[])[0];
          if (
            typeof slot === 'object' &&
            slot !== null &&
            'intensity' in slot
          ) {
            const intensity = (slot as Record<string, unknown>)['intensity'];
            if (
              typeof intensity === 'object' &&
              intensity !== null &&
              'forecast' in intensity &&
              'index' in intensity &&
              'from' in slot &&
              'to' in slot
            ) {
              setData({
                forecast: (intensity as Record<string, unknown>)['forecast'] as number,
                index: (intensity as Record<string, unknown>)['index'] as IntensityIndex,
                from: (slot as Record<string, unknown>)['from'] as string,
                to: (slot as Record<string, unknown>)['to'] as string,
              });
            }
          }
        }
      })
      .catch(() => {/* degrade silently */})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        className="h-24 rounded-xl animate-pulse bg-[var(--border)]"
        role="status"
        aria-label="Loading current carbon intensity"
      />
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        Live intensity data unavailable.
      </p>
    );
  }

  const timeStr = new Date(data.from).toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 flex items-center gap-6">
      <div>
        <p className="text-sm text-[var(--text-muted)]">Carbon intensity</p>
        <p className={`text-4xl font-mono font-bold ${INDEX_COLORS[data.index] ?? 'text-[var(--text)]'}`}>
          {data.forecast}
          <span className="text-lg ml-1 font-sans font-normal text-[var(--text-muted)]">gCO₂/kWh</span>
        </p>
      </div>
      <div className="border-l border-[var(--border)] pl-6">
        <p className="text-sm text-[var(--text-muted)]">Level</p>
        <p className={`text-2xl font-semibold ${INDEX_COLORS[data.index] ?? 'text-[var(--text)]'}`}>
          {INDEX_LABELS[data.index]}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">at {timeStr}</p>
      </div>
    </div>
  );
}
