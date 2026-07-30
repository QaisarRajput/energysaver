'use client';

/**
 * TimelineChart — 48h dual-axis chart: price (p/kWh) + carbon intensity (gCO₂/kWh).
 * Lazy-loaded (next/dynamic, ssr:false). Uses a lightweight canvas sparkline until
 * uPlot is wired in a future iteration.
 *
 * ponytail: currently a canvas-based mini sparkline. Upgrade to uPlot when the bundle
 * budget allows a separate lazy chunk; uPlot adds ~45 KB to this panel only.
 */
import { useEffect, useRef } from 'react';
import type { MergedSlot, Recommendation } from '@energysaver/schema';

interface Props {
  slots: MergedSlot[];
  recommendation: Recommendation;
}

export function TimelineChart({ slots, recommendation }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || slots.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.height;
    canvas.width = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const PAD = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    const prices = slots.map((s) => s.priceP);
    const intensities = slots.map((s) => s.intensityForecast);
    const maxPrice = Math.max(...prices, 1);
    const maxIntensity = Math.max(...intensities, 1);
    const n = slots.length;

    const xOf = (i: number) => PAD.left + (i / (n - 1)) * chartW;
    const yOfPrice = (p: number) => PAD.top + (1 - p / maxPrice) * chartH;
    const yOfCo2 = (c: number) => PAD.top + (1 - c / maxIntensity) * chartH;

    // Highlight recommended window
    const recStart = slots.findIndex((s) => s.from === recommendation.recommendedStart);
    const recEnd = slots.findIndex((s) => s.from === recommendation.recommendedEnd);
    if (recStart >= 0 && recEnd >= 0) {
      ctx.fillStyle = 'rgba(47,191,113,0.12)';
      ctx.fillRect(xOf(recStart), PAD.top, xOf(recEnd + 1) - xOf(recStart), chartH);
    }

    // Draw price line (blue)
    ctx.beginPath();
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 1.5;
    slots.forEach((s, i) => {
      const x = xOf(i);
      const y = yOfPrice(s.priceP);
      if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
    });
    ctx.stroke();

    // Draw carbon line (green)
    ctx.beginPath();
    ctx.strokeStyle = '#2FBF71';
    ctx.lineWidth = 1.5;
    slots.forEach((s, i) => {
      const x = xOf(i);
      const y = yOfCo2(s.intensityForecast);
      if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
    });
    ctx.stroke();

    // Axis labels (simplified)
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted') || '#6B7280';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('p/kWh', 2, PAD.top + 4);
    ctx.textAlign = 'right';
    ctx.fillText('gCO₂', W - 2, PAD.top + 4);

    // X axis labels: show every 6 slots (3h)
    ctx.textAlign = 'center';
    for (let i = 0; i < n; i += 6) {
      const slot = slots[i];
      if (!slot) continue;
      const label = new Date(slot.from).toLocaleString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/London',
      });
      ctx.fillText(label, xOf(i), H - 8);
    }
  }, [slots, recommendation]);

  if (slots.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No data to display.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-xs text-[var(--text-muted)]" aria-hidden>
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 h-0.5 bg-[#3B82F6]" /> Price (p/kWh)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 h-0.5 bg-[#2FBF71]" /> Carbon (gCO₂/kWh)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded-sm bg-[rgba(47,191,113,0.2)] border border-[#2FBF71]" /> Recommended window
        </span>
      </div>

      <canvas
        ref={canvasRef}
        height={220}
        className="w-full rounded-xl"
        role="img"
        aria-label={`48-hour timeline. Recommended window starts at ${new Date(recommendation.recommendedStart).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}.`}
      />

      {/* Visually hidden data table for accessibility */}
      <table className="sr-only">
        <caption>48-hour price and carbon intensity timeline</caption>
        <thead>
          <tr>
            <th>Time</th>
            <th>Price (p/kWh)</th>
            <th>Carbon (gCO₂/kWh)</th>
            <th>Estimated price?</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <tr key={s.from}>
              <td>{new Date(s.from).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</td>
              <td>{s.priceP.toFixed(1)}</td>
              <td>{s.intensityForecast}</td>
              <td>{s.priceEstimated ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
