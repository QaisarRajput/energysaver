'use client';

/**
 * ForecastGrid — 48h interactive carbon intensity grid, grouped into 4 × 12h windows.
 * Pure CSS grid + inline SVG. No chart lib. Replaces CarbonHeatmapRibbon.
 */
import { useEffect, useRef, useState } from 'react';
import { siteConfig } from '../config/site';
import { fmt12h } from '../lib/format-time';
import type { IntensityIndex } from '@energysaver/schema';

interface Slot {
  from: string;
  to: string;
  intensityForecast: number;
  intensityIndex: IntensityIndex;
}

const BAND_BG: Record<IntensityIndex, string> = {
  'very low': '#9bc400',
  low:        '#c5e04d',
  moderate:   '#f9c5bd',
  high:       '#f97316',
  'very high':'#dc2626',
};

const BAND_LABEL: Record<IntensityIndex, string> = {
  'very low': 'Very Low',
  low:        'Low',
  moderate:   'Moderate',
  high:       'High',
  'very high':'Very High',
};

/** Splits 96 slots into 4 named 12h groups */
function groupSlots(slots: Slot[]): { label: string; slots: Slot[] }[] {
  if (!slots.length) return [];

  // 12h = 24 × 30-min slots
  const groups: { label: string; slots: Slot[] }[] = [
    { label: '', slots: [] },
    { label: '', slots: [] },
    { label: '', slots: [] },
    { label: '', slots: [] },
  ];

  slots.forEach((s, i) => {
    const g = Math.min(Math.floor(i / 24), 3);
    groups[g]!.slots.push(s);
  });

  // Determine human labels based on time-of-day of first slot in each group
  const labels = ['Tonight / Now', 'Tomorrow AM', 'Tomorrow PM', 'Day After AM'];
  groups.forEach((g, i) => {
    const first = g.slots[0];
    if (!first) { g.label = labels[i] ?? `Window ${i + 1}`; return; }
    const localHour = parseInt(
      new Date(first.from).toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' }),
      10
    );
    if (localHour >= 0 && localHour < 12) {
      g.label = i === 0 ? 'Tonight' : (i === 2 ? 'Tomorrow AM' : 'Day After AM');
    } else {
      g.label = i === 1 ? 'Today PM' : (i === 3 ? 'Tomorrow PM' : 'Day After PM');
    }
    // Override with reasonable defaults based on order
    g.label = labels[i] ?? g.label;
  });

  return groups.filter((g) => g.slots.length > 0);
}

interface TooltipState {
  slot: Slot;
  x: number;
  y: number;
}

export function ForecastGrid() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    fetch(`${siteConfig.data.carbonApiBase}/intensity/${from}/${to}`)
      .then((r) => r.json())
      .then((json: unknown) => {
        if (
          typeof json === 'object' && json !== null && 'data' in json &&
          Array.isArray((json as Record<string, unknown>)['data'])
        ) {
          const raw = (json as Record<string, unknown>)['data'] as unknown[];
          const parsed: Slot[] = raw.flatMap((item) => {
            if (typeof item !== 'object' || item === null) return [];
            const r = item as Record<string, unknown>;
            // The forecast API returns nested {from, to, intensity: {forecast, index}}
            if (
              typeof r['from'] === 'string' && typeof r['to'] === 'string' &&
              typeof r['intensity'] === 'object' && r['intensity'] !== null
            ) {
              const intens = r['intensity'] as Record<string, unknown>;
              return [{
                from: r['from'],
                to: r['to'],
                intensityForecast: intens['forecast'] as number ?? 0,
                intensityIndex: intens['index'] as IntensityIndex ?? 'moderate',
              }];
            }
            return [];
          });
          setSlots(parsed);
        }
      })
      .catch(() => {/* degrade silently */})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 animate-pulse h-32" role="status" aria-label="Loading 48h forecast" />
    );
  }

  if (!slots.length) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 text-sm text-[var(--text-muted)]">
        48h forecast unavailable.
      </div>
    );
  }

  const groups = groupSlots(slots);
  const nowMs = Date.now();

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border-2 bg-[var(--bg-card)] p-5 space-y-3 relative shadow-card"
      style={{ borderColor: '#e8e0f0' }}
      aria-label="48-hour carbon intensity forecast grid"
      onMouseLeave={() => setTooltip(null)}
    >
      <p className="text-xs font-bold uppercase tracking-widest mb-0" style={{ color: '#7c677f' }}>
        48h Forecast — hover for details
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1.5">
            {/* Group header */}
            <p className="text-xs font-semibold text-[var(--text)] truncate">{group.label}</p>

            {/* Cell grid: 24 cells per group (12 h × 2 per hour) */}
            <div
              className="grid gap-px"
              style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}
              role="row"
              aria-label={group.label}
            >
              {group.slots.map((slot) => {
                const slotMs = new Date(slot.from).getTime();
                const isNow = slotMs <= nowMs && nowMs < slotMs + 30 * 60 * 1000;
                const isPast = slotMs < nowMs && !isNow;
                const color = BAND_BG[slot.intensityIndex] ?? '#6B7280';

                return (
                  <button
                    key={slot.from}
                    role="gridcell"
                    aria-label={`${fmt12h(slot.from)} — ${slot.intensityForecast} gCO₂/kWh ${BAND_LABEL[slot.intensityIndex]}`}
                    className={`relative h-6 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] transition-transform hover:scale-110 hover:z-10 ${isPast ? 'opacity-40' : ''}`}
                    style={{ background: color }}
                    onMouseEnter={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      const btnRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setTooltip({
                        slot,
                        x: btnRect.left - (rect?.left ?? 0) + btnRect.width / 2,
                        y: btnRect.top - (rect?.top ?? 0) - 8,
                      });
                    }}
                    onClick={() => {
                      // Pre-fill calculator with this slot's time
                      const url = `/calculator?from=${encodeURIComponent(slot.from)}`;
                      window.location.href = url;
                    }}
                  >
                    {isNow && (
                      <span
                        className="absolute inset-0 rounded-sm ring-2 ring-white ring-offset-1 animate-pulse"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Hour labels below: every 4 cells = 2h */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
              {group.slots
                .filter((_, i) => i % 4 === 0)
                .map((slot) => (
                  <span
                    key={slot.from}
                    className="text-[9px] text-[var(--text-muted)] text-center leading-tight col-span-2 truncate"
                    style={{ gridColumn: 'span 2' }}
                  >
                    {fmt12h(slot.from).replace(':00', '').replace(' am', 'a').replace(' pm', 'p')}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Intensity legend */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--border)]">
        {(Object.entries(BAND_BG) as [IntensityIndex, string][]).map(([key, color]) => (
          <span key={key} className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color }} aria-hidden />
            {BAND_LABEL[key]}
          </span>
        ))}
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none glass rounded-xl border border-[var(--glass-border)] px-3 py-2 text-xs shadow-lg -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
          role="tooltip"
        >
          <p className="font-semibold text-[var(--text)]">{fmt12h(tooltip.slot.from)}</p>
          <p className="text-[var(--text-muted)]">
            <span
              className="inline-block w-2 h-2 rounded-full mr-1"
              style={{ background: BAND_BG[tooltip.slot.intensityIndex] }}
              aria-hidden
            />
            {tooltip.slot.intensityForecast} gCO₂/kWh — {BAND_LABEL[tooltip.slot.intensityIndex]}
          </p>
          <p className="text-[var(--accent)] mt-0.5">Click to open calculator →</p>
        </div>
      )}

      {/* Visually-hidden accessible table */}
      <table className="sr-only">
        <caption>48h carbon intensity forecast</caption>
        <thead><tr><th>Time</th><th>gCO₂/kWh</th><th>Level</th></tr></thead>
        <tbody>
          {slots.map((s) => (
            <tr key={s.from}>
              <td>{fmt12h(s.from)}</td>
              <td>{s.intensityForecast}</td>
              <td>{BAND_LABEL[s.intensityIndex]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
