'use client';

/**
 * SavingsResult — the payoff card showing recommended start time, savings vs baseline,
 * animated numbers, CO₂ equivalences, and share button.
 */
import { useEffect, useRef, lazy, Suspense } from 'react';
import type { Recommendation, Appliance } from '@energysaver/schema';
import { fmt12hWithDay, fmt12h } from '../lib/format-time';

const NotificationPanel = lazy(() => import('./NotificationPanel').then((m) => ({ default: m.NotificationPanel })));

interface Props {
  recommendation: Recommendation;
  appliance: Appliance;
}

function formatGbp(gbp: number): string {
  return gbp >= 0.01 ? `£${gbp.toFixed(2)}` : `${(gbp * 100).toFixed(1)}p`;
}

function formatCo2(kg: number): string {
  return kg >= 1 ? `${kg.toFixed(2)} kg` : `${(kg * 1000).toFixed(0)} g`;
}

// ---- Animated number ticker ----
function useTicker(target: number, duration = 900) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || target === 0) { el.textContent = target.toFixed(0); return; }
    const start = performance.now();
    let raf: number;
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      el!.textContent = (target * ease).toFixed(0);
      if (t < 1) raf = requestAnimationFrame(step);
      else el!.textContent = target.toFixed(0);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return ref;
}

// ---- CO₂ Equivalences ----
// Sources: BEIS 2024 (car), Atmosfair (flight), IEA 2023 (streaming)
const EQUIVALENCES = [
  { label: 'km by car', factor: 1 / 0.120, icon: '🚗' },
  { label: 'hrs laptop use', factor: 1 / 0.003, icon: '💻' },
  { label: 'km by plane', factor: 1 / 0.255, icon: '✈️' },
  { label: 'hrs streaming', factor: 1 / 0.036, icon: '📺' },
];

function Co2Equivalences({ savingKg }: { savingKg: number }) {
  if (savingKg <= 0) return null;
  const savingG = savingKg * 1000;
  const scored = EQUIVALENCES.map((e) => {
    const val = savingG * e.factor;
    const dist = Math.abs(Math.log10(Math.max(val, 0.001)));
    return { ...e, val, dist };
  }).sort((a, b) => a.dist - b.dist);
  return (
    <div className="flex flex-wrap gap-2 mt-2" aria-label="CO₂ saving equivalences">
      {scored.slice(0, 3).map((e) => (
        <span key={e.label}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)] border border-[var(--border)]"
        >
          <span aria-hidden>{e.icon}</span>
          ≈ <strong className="text-[#9bc400]">{e.val < 10 ? e.val.toFixed(1) : Math.round(e.val)}</strong> {e.label}
        </span>
      ))}
    </div>
  );
}

function ShareButton({ url, label }: { url: string; label: string }) {
  async function handle() {
    try {
      if (navigator.share) { await navigator.share({ title: 'EnergySaver', text: label, url }); }
      else { await navigator.clipboard.writeText(url); }
    } catch { /* user cancelled */ }
  }
  return (
    <button onClick={handle}
      className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
      aria-label="Share this result"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
      Share
    </button>
  );
}

export function SavingsResult({ recommendation: r, appliance }: Props) {
  const saving = r.savingGbp > 0.001 || r.savingCo2Kg > 0;
  const co2GRef = useTicker(r.savingCo2Kg * 1000);
  const costPRef = useTicker(r.savingGbp * 100);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-5 shadow-sm">
      {/* Headline */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
          Best time to run your {appliance.name}
        </p>
        <p className="text-5xl font-mono font-bold text-[var(--accent)] leading-none">
          {fmt12hWithDay(r.recommendedStart)}
        </p>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          until {fmt12h(r.recommendedEnd)} · {(r.runSlots * 0.5).toFixed(1)}h run
        </p>
        {r.hasEstimatedPrices && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] px-2 py-0.5 rounded-full border border-[color-mix(in_srgb,var(--warning)_30%,transparent)]">
            <span aria-hidden>⚠</span> Prices estimated — Agile not yet published for this window
          </p>
        )}
      </div>

      {/* Savings vs baseline */}
      {saving ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border border-[color-mix(in_srgb,var(--success)_25%,transparent)] p-4 text-center">
            <p className="text-xs text-[var(--text-muted)] mb-1">vs running at peak</p>
            <p className="text-2xl font-mono font-bold text-[#9bc400]">
              Save <span ref={costPRef}>{(r.savingGbp * 100).toFixed(0)}</span>p
            </p>
          </div>
          <div className="rounded-xl bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border border-[color-mix(in_srgb,var(--success)_25%,transparent)] p-4 text-center">
            <p className="text-xs text-[var(--text-muted)] mb-1">CO₂ saved</p>
            <p className="text-2xl font-mono font-bold text-[#9bc400]">
              <span ref={co2GRef}>{(r.savingCo2Kg * 1000).toFixed(0)}</span> g
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] p-4 text-center text-[var(--text-muted)] text-sm">
          <span aria-hidden>✓</span> Already at an optimal time — no shift needed.
        </div>
      )}

      {saving && <Co2Equivalences savingKg={r.savingCo2Kg} />}

      {/* Run stats */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="Est. cost" value={formatGbp(r.recommendedCostGbp)} />
        <Stat label="Est. CO₂" value={formatCo2(r.recommendedCo2Kg)} />
        <Stat label="Duration" value={`${(r.runSlots * 0.5).toFixed(1)}h`} />
      </div>

      {/* Alternatives */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Also consider</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <AltWindow label="💰 Cheapest" start={r.cheapestStart} end={r.cheapestEnd} cost={r.cheapestCostGbp} co2={r.cheapestCo2Kg} />
          <AltWindow label="🌿 Greenest" start={r.greenestStart} end={r.greenestEnd} cost={r.greenestCostGbp} co2={r.greenestCo2Kg} />
        </div>
      </div>

      {/* Notification reminders */}
      <Suspense fallback={null}>
        <NotificationPanel
          applianceId={appliance.id}
          applianceName={appliance.name}
          recommendedStart={r.recommendedStart}
        />
      </Suspense>

      {/* Disclaimer + share */}
      <div className="flex items-center justify-between gap-4 pt-2 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)]">
          Estimates only.{' '}
          <a href="/terms" className="underline hover:text-[var(--accent)]">Terms</a>
        </p>
        <ShareButton
          url={typeof window !== 'undefined' ? window.location.href : ''}
          label={`Best time for ${appliance.name}: ${fmt12hWithDay(r.recommendedStart)}`}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] px-3 py-2">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="font-mono font-semibold text-[var(--text)] text-sm mt-0.5">{value}</p>
    </div>
  );
}

function AltWindow({
  label,
  start,
  end,
  cost,
  co2,
}: {
  label: string;
  start: string;
  end: string;
  cost: number;
  co2: number;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
      <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
      <p className="font-mono font-semibold text-[var(--text)] mt-0.5 text-sm">
        {fmt12hWithDay(start)}
      </p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5">
        {formatGbp(cost)} · {formatCo2(co2)} CO₂ · until {fmt12h(end)}
      </p>
    </div>
  );
}



