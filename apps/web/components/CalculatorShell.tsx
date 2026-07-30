'use client';

/**
 * CalculatorShell — the main interactive tool.
 * State (appliance, tariff, postcode, tab) is stored in URL query params for shareability (§12).
 */
import { useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import appliancesRaw from '../../../data/appliances.json';
import tariffsRaw from '../../../data/tariffs.json';
import { ApplianceSchema, TariffPresetSchema } from '@energysaver/schema';
import type { Appliance, TariffPreset, MergedSlot, Recommendation } from '@energysaver/schema';
import { getCarbonForecast, getAgileRates } from '../lib/api-clients';
import { mergeSlots } from '../lib/merge-slots';
import { findBestWindow } from '../lib/find-best-window';
import { lookupRegion } from '../lib/region-lookup';
import { SavingsResult } from './SavingsResult';

// Lazy-loaded panels
const TimelineChart = dynamic(() => import('./TimelineChart').then((m) => m.TimelineChart), {
  ssr: false,
  loading: () => <PanelSkeleton label="Loading timeline chart…" />,
});
const SlotGrid = dynamic(() => import('./SlotGrid').then((m) => m.SlotGrid), {
  ssr: false,
  loading: () => <PanelSkeleton label="Loading slot grid…" />,
});
const TariffCompare = dynamic(() => import('./TariffCompare').then((m) => m.TariffCompare), {
  ssr: false,
  loading: () => <PanelSkeleton label="Loading tariff comparison…" />,
});
const ScatterPlot = dynamic(() => import('./ScatterPlot').then((m) => m.ScatterPlot), {
  ssr: false,
  loading: () => <PanelSkeleton label="Loading scatter plot…" />,
});

const APPLIANCES: Appliance[] = (appliancesRaw as unknown[]).flatMap((a) => {
  const r = ApplianceSchema.safeParse(a);
  return r.success ? [r.data] : [];
});

const TARIFFS: TariffPreset[] = (tariffsRaw as unknown[]).flatMap((t) => {
  const r = TariffPresetSchema.safeParse(t);
  return r.success ? [r.data] : [];
});

type Tab = 'recommendation' | 'timeline' | 'slots' | 'compare' | 'scatter';

function PanelSkeleton({ label }: { label: string }) {
  return (
    <div className="h-64 flex items-center justify-center rounded-xl bg-[var(--border)] animate-pulse text-[var(--text-muted)] text-sm">
      {label}
    </div>
  );
}

function CalculatorForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [applianceId, setApplianceId] = useState(params.get('appliance') ?? APPLIANCES[0]?.id ?? '');
  const [tariffId, setTariffId] = useState(params.get('tariff') ?? 'flat-standard');
  const [postcode, setPostcode] = useState(params.get('postcode') ?? '');
  const [useAgile, setUseAgile] = useState(params.get('agile') === '1');
  const [weight, setWeight] = useState(Number(params.get('weight') ?? 0.5));
  const [activeTab, setActiveTab] = useState<Tab>((params.get('tab') as Tab) ?? 'recommendation');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slots, setSlots] = useState<MergedSlot[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  const appliance = APPLIANCES.find((a) => a.id === applianceId) ?? APPLIANCES[0];
  const tariff = TARIFFS.find((t) => t.id === tariffId) ?? TARIFFS[0];

  const pushParams = useCallback(
    (overrides: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      router.replace(`/calculator?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const handleRun = useCallback(async () => {
    if (!appliance || !tariff) return;
    setLoading(true);
    setError('');
    setRecommendation(null);

    try {
      const region = postcode ? lookupRegion(postcode) : undefined;
      const now = new Date();
      const from = now.toISOString();
      const to = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

      const [carbon, agile] = await Promise.all([
        getCarbonForecast(region ? postcode : undefined),
        useAgile && region ? getAgileRates(region.gspLetter, from, to) : Promise.resolve([]),
      ]);

      if (carbon.length === 0) {
        setError('Could not load carbon intensity data. Please try again.');
        return;
      }

      const merged = mergeSlots(carbon, agile, tariff);
      setSlots(merged);

      const runSlots = Math.max(1, Math.ceil(appliance.defaultRunHours / 0.5));
      const rec = findBestWindow({
        slots: merged,
        applianceId: appliance.id,
        powerKw: appliance.powerKw,
        runSlots,
        weight,
      });
      setRecommendation(rec);

      pushParams({
        appliance: appliance.id,
        tariff: tariff.id,
        postcode,
        agile: useAgile ? '1' : '',
        weight: String(weight),
        tab: activeTab,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [appliance, tariff, postcode, useAgile, weight, activeTab, pushParams]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'recommendation', label: 'Recommendation' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'slots', label: 'All slots' },
    { id: 'compare', label: 'Compare tariffs' },
    { id: 'scatter', label: 'Best slots' },
  ];

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 rounded-2xl border-2 bg-[var(--bg-card)] shadow-card" style={{ borderColor: '#e8e0f0' }}>
        <div>
          <label htmlFor="appliance" className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "#7c677f" }}>
            Appliance
          </label>
          <select
            id="appliance"
            value={applianceId}
            onChange={(e) => setApplianceId(e.target.value)}
            className="w-full rounded-xl border-2 bg-[var(--bg)] px-3 py-2.5 text-sm font-medium" style={{ borderColor: '#e8e0f0', color: '#2d2640' }}
          >
            {APPLIANCES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="postcode" className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "#7c677f" }}>
            Postcode <span className="text-[var(--text-muted)] font-normal">(optional)</span>
          </label>
          <input
            id="postcode"
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            placeholder="e.g. RG41"
            maxLength={8}
            className="w-full rounded-xl border-2 bg-[var(--bg)] px-3 py-2.5 text-sm font-mono" style={{ borderColor: '#e8e0f0', color: '#2d2640' }}
            aria-describedby="postcode-hint"
          />
          <p id="postcode-hint" className="text-xs text-[var(--text-muted)] mt-1">
            Used to get regional carbon data — not stored.
          </p>
        </div>

        <div>
          <label htmlFor="tariff" className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "#7c677f" }}>
            Tariff
          </label>
          <select
            id="tariff"
            value={tariffId}
            onChange={(e) => setTariffId(e.target.value)}
            className="w-full rounded-xl border-2 bg-[var(--bg)] px-3 py-2.5 text-sm font-medium" style={{ borderColor: '#e8e0f0', color: '#2d2640' }}
          >
            {TARIFFS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useAgile}
              onChange={(e) => setUseAgile(e.target.checked)}
              className="w-4 h-4 accent-[var(--accent)]"
            />
            <span className="text-sm text-[var(--text)]">
              Use live Octopus Agile prices{' '}
              <span className="text-xs text-[var(--text-muted)]">(requires postcode)</span>
            </span>
          </label>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="weight" className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "#7c677f" }}>
            Priority: <span className="font-mono">{weight === 0 ? 'Cheapest' : weight === 1 ? 'Greenest' : 'Balanced'}</span>
          </label>
          <input
            id="weight"
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
            aria-label="Slide from cheapest (left) to greenest (right)"
          />
          <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
            <span>Cheapest £</span>
            <span>Greenest 🌿</span>
          </div>
        </div>

        <div className="sm:col-span-2">
          <button
            onClick={handleRun}
            disabled={loading}
            className="btn-pill w-full sm:w-auto px-7 py-3 text-white font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-green"
            style={{ background: loading ? '#85a800' : '#9bc400' }}
          >
            {loading ? 'Finding best time…' : 'Find best time'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {recommendation && (
        <>
          {/* Tabs */}
          <div role="tablist" aria-label="Insight panels" className="flex gap-1 border-b-2" style={{ borderColor: '#e8e0f0' }}>
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                tabIndex={activeTab === id ? 0 : -1}
                onClick={() => {
                  setActiveTab(id);
                  pushParams({ tab: id });
                }}
                onKeyDown={(e) => {
                  const idx = tabs.findIndex((t) => t.id === id);
                  if (e.key === 'ArrowRight') {
                    const next = tabs[(idx + 1) % tabs.length];
                    if (next) { setActiveTab(next.id); pushParams({ tab: next.id }); }
                  } else if (e.key === 'ArrowLeft') {
                    const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
                    if (prev) { setActiveTab(prev.id); pushParams({ tab: prev.id }); }
                  }
                }}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-[#9bc400] text-[#9bc400]'
                    : 'border-transparent text-[#7c677f] hover:text-[#8076a3]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <div role="tabpanel" aria-label={tabs.find((t) => t.id === activeTab)?.label}>
            {activeTab === 'recommendation' && appliance && (
              <SavingsResult recommendation={recommendation} appliance={appliance} />
            )}
            {activeTab === 'timeline' && (
              <Suspense fallback={<PanelSkeleton label="Loading timeline chart…" />}>
                <TimelineChart slots={slots} recommendation={recommendation} />
              </Suspense>
            )}
            {activeTab === 'slots' && (
              <Suspense fallback={<PanelSkeleton label="Loading slot grid…" />}>
                <SlotGrid slots={slots} recommendation={recommendation} />
              </Suspense>
            )}
            {activeTab === 'compare' && appliance && (
              <Suspense fallback={<PanelSkeleton label="Loading tariff comparison…" />}>
                <TariffCompare slots={slots} appliance={appliance} allTariffs={TARIFFS} />
              </Suspense>
            )}
            {activeTab === 'scatter' && (
              <Suspense fallback={<PanelSkeleton label="Loading scatter plot…" />}>
                <ScatterPlot slots={slots} recommendation={recommendation} />
              </Suspense>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function CalculatorShell() {
  return (
    <Suspense fallback={<PanelSkeleton label="Loading calculator…" />}>
      <CalculatorForm />
    </Suspense>
  );
}
