'use client';

/**
 * ScatterPlot — price vs carbon intensity scatter for every 30-min slot.
 * Pure canvas, no chart lib. ~100 lines of geometry.
 */
import { useEffect, useRef } from 'react';
import type { MergedSlot, Recommendation } from '@energysaver/schema';
import { fmt12hWithDay } from '../lib/format-time';

interface Props {
  slots: MergedSlot[];
  recommendation: Recommendation;
}

const BAND_COLORS: Record<string, string> = {
  'very low': '#9bc400',
  low: '#c5e04d',
  moderate: '#f9c5bd',
  high: '#f97316',
  'very high': '#dc2626',
};

export function ScatterPlot({ slots, recommendation: r }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef(slots);
  const recRef = useRef(r);
  slotsRef.current = slots;
  recRef.current = r;

  // --- Drawing ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !slots.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Padding
    const PAD = { top: 20, right: 20, bottom: 40, left: 48 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    // Data ranges
    const prices = slots.map((s) => s.priceP);
    const carbons = slots.map((s) => s.intensityForecast);
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const minC = Math.min(...carbons), maxC = Math.max(...carbons);
    const pRange = maxP - minP || 1;
    const cRange = maxC - minC || 1;

    function toScreen(p: number, c: number): [number, number] {
      const sx = PAD.left + ((p - minP) / pRange) * plotW;
      const sy = PAD.top + plotH - ((c - minC) / cRange) * plotH;
      return [sx, sy];
    }

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Quadrant backgrounds
    const midP = (minP + maxP) / 2;
    const midC = (minC + maxC) / 2;
    const [midX] = toScreen(midP, midC);
    const [, midY] = toScreen(midP, midC);

    // low-price + low-carbon (best) quadrant: bottom-left
    ctx.fillStyle = 'rgba(47,191,113,0.06)';
    ctx.fillRect(PAD.left, midY, midX - PAD.left, plotH - (midY - PAD.top));

    // high-price + high-carbon (worst) quadrant: top-right
    ctx.fillStyle = 'rgba(239,68,68,0.06)';
    ctx.fillRect(midX, PAD.top, plotW - (midX - PAD.left), midY - PAD.top);

    // Axes
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border') || '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top + plotH);
    ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted') || '#6B7280';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Price (p/kWh) →', PAD.left + plotW / 2, H - 6);
    ctx.save();
    ctx.translate(14, PAD.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Carbon (gCO₂/kWh) →', 0, 0);
    ctx.restore();

    // Quadrant labels
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#2FBF71';
    ctx.textAlign = 'left';
    ctx.fillText('✓ Cheapest & Greenest', PAD.left + 6, PAD.top + plotH - 6);
    ctx.fillStyle = '#EF4444';
    ctx.textAlign = 'right';
    ctx.fillText('✗ Costly & Dirty', PAD.left + plotW - 4, PAD.top + 14);

    // Recommended window slots (outlined)
    const recFromMs = new Date(r.recommendedStart).getTime();
    const recToMs = new Date(r.recommendedEnd).getTime();

    // Draw all dots
    slots.forEach((slot) => {
      const [sx, sy] = toScreen(slot.priceP, slot.intensityForecast);
      const inRec = new Date(slot.from).getTime() >= recFromMs && new Date(slot.from).getTime() < recToMs;
      const color = BAND_COLORS[slot.intensityIndex] ?? '#6B7280';

      if (inRec) {
        // Highlighted ring
        ctx.beginPath();
        ctx.arc(sx, sy, 8, 0, Math.PI * 2);
        ctx.fillStyle = `${color}30`;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = inRec ? color : `${color}99`;
      ctx.fill();
    });
  }, [slots, r]);

  // --- Hover tooltip ---
  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const tooltip = tooltipRef.current;
    if (!canvas || !tooltip) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const PAD = { top: 20, right: 20, bottom: 40, left: 48 };
    const W = rect.width, H = rect.height;
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    const s = slotsRef.current;
    if (!s.length) return;

    const prices = s.map((x) => x.priceP);
    const carbons = s.map((x) => x.intensityForecast);
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const minC = Math.min(...carbons), maxC = Math.max(...carbons);
    const pRange = maxP - minP || 1;
    const cRange = maxC - minC || 1;

    // Find nearest dot
    let best: MergedSlot | null = null;
    let bestDist = Infinity;
    let bestX = 0, bestY = 0;
    s.forEach((slot) => {
      const sx = PAD.left + ((slot.priceP - minP) / pRange) * plotW;
      const sy = PAD.top + plotH - ((slot.intensityForecast - minC) / cRange) * plotH;
      const d = Math.hypot(mx - sx, my - sy);
      if (d < bestDist) { bestDist = d; best = slot; bestX = sx; bestY = sy; }
    });

    if (best && bestDist < 20) {
      tooltip.style.display = 'block';
      tooltip.style.left = `${bestX}px`;
      tooltip.style.top = `${bestY - 8}px`;
      const slot = best as MergedSlot;
      tooltip.innerHTML = `
        <p class="font-semibold">${fmt12hWithDay(slot.from)}</p>
        <p>${slot.priceP.toFixed(1)}p/kWh · ${slot.intensityForecast} gCO₂/kWh</p>
        <p class="text-[var(--text-muted)] capitalize">${slot.intensityIndex}</p>
        ${slot.priceEstimated ? '<p class="text-[var(--warning)] text-xs">Est. price</p>' : ''}
      `;
    } else {
      tooltip.style.display = 'none';
    }
  }

  return (
    <div className="relative w-full" style={{ height: 320 }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { if (tooltipRef.current) tooltipRef.current.style.display = 'none'; }}
        aria-label="Price vs carbon intensity scatter plot"
        role="img"
      />
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none glass rounded-xl border border-[var(--glass-border)] px-3 py-2 text-xs shadow-lg -translate-x-1/2 -translate-y-full z-10"
        style={{ display: 'none' }}
        role="tooltip"
      />
    </div>
  );
}
