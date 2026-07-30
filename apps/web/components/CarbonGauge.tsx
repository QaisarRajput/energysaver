'use client';

/**
 * CarbonGauge — semi-circular SVG arc gauge showing live carbon intensity.
 * Pure SVG + CSS, no canvas lib. Spring-animated needle.
 * Replaces CurrentIntensityWidget.
 */
import { useEffect, useRef, useState } from 'react';
import { siteConfig } from '../config/site';
import type { IntensityIndex } from '@energysaver/schema';
import { fmt12h } from '../lib/format-time';

interface CurrentIntensity {
  forecast: number;
  index: IntensityIndex;
  from: string;
  to: string;
}

// Gradient stops along the 180° arc (left = clean, right = dirty)
// gCO₂/kWh scale: 0 – 700 mapped to 0° – 180°
const SCALE_MAX = 650; // practical UK max

const BAND_COLORS: Record<IntensityIndex, string> = {
  'very low': '#9bc400',
  low: '#c5e04d',
  moderate: '#f9c5bd',
  high: '#f97316',
  'very high': '#dc2626',
};

const BAND_LABELS: Record<IntensityIndex, string> = {
  'very low': 'Very Low',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  'very high': 'Very High',
};

/** Convert polar (cx,cy,r,angleDeg) → SVG {x,y} */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** SVG arc path for a segment of the gauge ring */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

// Gauge geometry
const CX = 150, CY = 130, R_OUTER = 110, R_INNER = 78, R_TICK = 68;

// Band boundaries in gCO₂/kWh (approx Carbon Intensity API thresholds)
const BANDS: { label: IntensityIndex; from: number; to: number; color: string }[] = [
  { label: 'very low', from: 0,   to: 100, color: '#9bc400' },
  { label: 'low',      from: 100, to: 200, color: '#c5e04d' },
  { label: 'moderate', from: 200, to: 300, color: '#f9c5bd' },
  { label: 'high',     from: 300, to: 450, color: '#f97316' },
  { label: 'very high', from: 450, to: SCALE_MAX, color: '#dc2626' },
];

function intensityToAngle(gco2: number): number {
  return Math.min((gco2 / SCALE_MAX) * 180, 180);
}

export function CarbonGauge() {
  const [data, setData] = useState<CurrentIntensity | null>(null);
  const [loading, setLoading] = useState(true);
  const needleRef = useRef<SVGLineElement>(null);
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    fetch(`${siteConfig.data.carbonApiBase}/intensity`)
      .then((r) => r.json())
      .then((json: unknown) => {
        if (
          typeof json === 'object' && json !== null && 'data' in json &&
          Array.isArray((json as Record<string, unknown>)['data'])
        ) {
          const slot = ((json as Record<string, unknown>)['data'] as unknown[])[0];
          if (typeof slot === 'object' && slot !== null && 'intensity' in slot) {
            const intensity = (slot as Record<string, unknown>)['intensity'];
            if (
              typeof intensity === 'object' && intensity !== null &&
              'forecast' in intensity && 'index' in intensity &&
              'from' in slot && 'to' in slot
            ) {
              const d: CurrentIntensity = {
                forecast: (intensity as Record<string, unknown>)['forecast'] as number,
                index: (intensity as Record<string, unknown>)['index'] as IntensityIndex,
                from: (slot as Record<string, unknown>)['from'] as string,
                to: (slot as Record<string, unknown>)['to'] as string,
              };
              setData(d);
              // Delay angle update so the CSS transition animates in
              setTimeout(() => setAngle(intensityToAngle(d.forecast)), 50);
            }
          }
        }
      })
      .catch(() => {/* degrade silently */})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 animate-pulse h-48" role="status" aria-label="Loading carbon intensity" />
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 text-sm text-[var(--text-muted)]">
        Live intensity data unavailable.
      </div>
    );
  }

  const bandColor = BAND_COLORS[data.index] ?? '#6B7280';
  const needleEnd = polar(CX, CY, R_INNER - 8, angle);

  return (
    <div
      className="rounded-2xl border-2 bg-[var(--bg-card)] p-5 flex flex-col items-center shadow-card"
      style={{ borderColor: '#e8e0f0' }}
      role="meter"
      aria-valuenow={data.forecast}
      aria-valuemin={0}
      aria-valuemax={SCALE_MAX}
      aria-label={`Current carbon intensity: ${data.forecast} gCO₂/kWh — ${BAND_LABELS[data.index]}`}
    >
      <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#7c677f' }}>
        Grid Carbon Intensity
      </p>

      <svg width="300" height="160" viewBox="0 0 300 160" aria-hidden="true" className="w-full max-w-xs">
        {/* Band arc segments */}
        {BANDS.map((b) => (
          <path
            key={b.label}
            d={arcPath(CX, CY, (R_OUTER + R_INNER) / 2, intensityToAngle(b.from), intensityToAngle(b.to))}
            stroke={b.color}
            strokeWidth={R_OUTER - R_INNER}
            strokeLinecap="butt"
            fill="none"
            opacity="0.85"
          />
        ))}

        {/* Tick marks at band boundaries */}
        {[0, 100, 200, 300, 450, SCALE_MAX].map((val) => {
          const a = intensityToAngle(val);
          const outer = polar(CX, CY, R_OUTER + 4, a);
          const inner = polar(CX, CY, R_TICK, a);
          return (
            <line key={val} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
              stroke="var(--border)" strokeWidth="1.5" />
          );
        })}

        {/* Tick labels */}
        {[0, 200, 450].map((val) => {
          const a = intensityToAngle(val);
          const pt = polar(CX, CY, R_OUTER + 16, a);
          return (
            <text key={val} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fill="var(--text-muted)" fontFamily="monospace">
              {val}
            </text>
          );
        })}

        {/* Needle */}
        <line
          ref={needleRef}
          x1={CX} y1={CY}
          x2={needleEnd.x} y2={needleEnd.y}
          stroke={bandColor}
          strokeWidth="3"
          strokeLinecap="round"
          style={{
            transformOrigin: `${CX}px ${CY}px`,
            transition: 'all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
        {/* Needle hub */}
        <circle cx={CX} cy={CY} r="7" fill={bandColor} />
        <circle cx={CX} cy={CY} r="3" fill="var(--bg-card)" />

        {/* Centre value text */}
        <text x={CX} y={CY + 28} textAnchor="middle" fontSize="28" fontWeight="700"
          fontFamily="monospace" fill={bandColor}>
          {data.forecast}
        </text>
        <text x={CX} y={CY + 44} textAnchor="middle" fontSize="10"
          fill="var(--text-muted)" fontFamily="sans-serif">
          gCO₂/kWh
        </text>
      </svg>

      {/* Band label + time */}
      <div className="flex items-center gap-3 mt-1">
        <span
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full"
          style={{ color: bandColor, background: `${bandColor}18` }}
        >
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: bandColor }}
            aria-hidden
          />
          {BAND_LABELS[data.index]}
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          at {fmt12h(data.from)}
        </span>
      </div>
    </div>
  );
}
