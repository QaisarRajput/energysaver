'use client';

/**
 * PlannerIsland — full multi-appliance Day Planner.
 * URL state: ?appliances=tumble-dryer:0.5,dishwasher:0.5&postcode=SW1A&tariff=flat-standard
 */
import { useCallback, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import appliancesRaw from '../../../data/appliances.json';
import tariffsRaw from '../../../data/tariffs.json';
import { ApplianceSchema, TariffPresetSchema } from '@energysaver/schema';
import type { Appliance, TariffPreset, MergedSlot, Assignment } from '@energysaver/schema';
import { getCarbonForecast, getAgileRates } from '../lib/api-clients';
import { mergeSlots } from '../lib/merge-slots';
import { lookupRegion } from '../lib/region-lookup';
import { schedulePlan } from '../lib/schedule-plan';
import { fmt12h, fmt12hWithDay } from '../lib/format-time';

// ─── Data ─────────────────────────────────────────────────────────────────────
const STATIC_APPLIANCES: Appliance[] = (appliancesRaw as unknown[]).flatMap((a) => {
  const r = ApplianceSchema.safeParse(a);
  return r.success ? [r.data] : [];
});
const TARIFFS: TariffPreset[] = (tariffsRaw as unknown[]).flatMap((t) => {
  const r = TariffPresetSchema.safeParse(t);
  return r.success ? [r.data] : [];
});

const CATEGORY_LABELS: Record<string, string> = {
  laundry: 'Laundry',
  kitchen: 'Kitchen',
  ev: 'EV & Batteries',
  heating: 'Heating & Cooling',
  bathroom: 'Bathroom',
  computing: 'Computing',
  other: 'Other',
  custom: 'My Custom Appliances',
};

function getCustomAppliances(): Appliance[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('custom-appliances');
    if (!raw) return [];
    return JSON.parse(raw) as Appliance[];
  } catch { return []; }
}

function saveCustomAppliances(list: Appliance[]) {
  try { localStorage.setItem('custom-appliances', JSON.stringify(list)); } catch { /* noop */ }
}

function formatGbp(n: number) { return n >= 0.01 ? `£${n.toFixed(2)}` : `${(n * 100).toFixed(1)}p`; }
function formatCo2(kg: number) { return kg >= 1 ? `${kg.toFixed(2)} kg` : `${(kg * 1000).toFixed(0)} g`; }


// ─── Types ──────────────────────────────────────────────────────────────────
interface PlanItem {
  appliance: Appliance;
  weight: number; // 0=cheapest 1=greenest
  earliestStartHhMm?: string;
  latestEndHhMm?: string;
}

// ─── Gantt ────────────────────────────────────────────────────────────────────
const BAND_COLOR: Record<string, string> = {
  'very low': '#2FBF71', low: '#86EFAC', moderate: '#FCD34D', high: '#F97316', 'very high': '#DC2626',
};

function PlannerGantt({ items, assignments, slots }: { items: PlanItem[]; assignments: Assignment[]; slots: MergedSlot[] }) {
  if (!slots.length) return null;

  const firstMs = new Date(slots[0]!.from).getTime();
  const lastMs = new Date(slots[slots.length - 1]!.to).getTime();
  const totalMs = lastMs - firstMs;

  function toPct(isoTime: string) {
    return ((new Date(isoTime).getTime() - firstMs) / totalMs) * 100;
  }

  // Build slot color strip (carbon bg)
  const NOW_PCT = ((Date.now() - firstMs) / totalMs) * 100;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Time axis header */}
        <div className="relative h-7 border-b border-[var(--border)] mb-2 ml-28">
          {Array.from({ length: 9 }, (_, i) => i * 6).map((h) => {
            const pct = (h / 48) * 100;
            return (
              <span
                key={h}
                className="absolute text-[10px] text-[var(--text-muted)] -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                +{h}h
              </span>
            );
          })}
        </div>

        {/* Carbon strip background */}
        <div className="relative h-3 ml-28 mb-3 rounded-full overflow-hidden flex">
          {slots.map((s) => {
            const color = BAND_COLOR[s.intensityIndex] ?? '#6B7280';
            return <div key={s.from} style={{ flex: 1, background: color, opacity: 0.6 }} />;
          })}
          {/* Now marker */}
          {NOW_PCT > 0 && NOW_PCT < 100 && (
            <div className="absolute top-0 bottom-0 w-0.5 bg-white/80" style={{ left: `${NOW_PCT}%` }} />
          )}
        </div>

        {/* Appliance rows */}
        {items.map((item) => {
          const asgn = assignments.find((a) => a.applianceId === item.appliance.id);
          return (
            <div key={item.appliance.id} className="flex items-center mb-2">
              <div className="w-28 pr-2 text-xs text-[var(--text)] truncate shrink-0">
                {item.appliance.name}
              </div>
              <div className="relative flex-1 h-8 bg-[var(--surface-muted)] rounded-lg border border-[var(--border)] overflow-hidden">
                {asgn && (
                  <div
                    className="absolute h-full rounded-lg flex items-center justify-center text-xs font-semibold text-white"
                    style={{
                      left: `${toPct(asgn.start)}%`,
                      width: `${toPct(asgn.end) - toPct(asgn.start)}%`,
                      background: '#2FBF71',
                      outline: asgn.overlaps ? '2px solid #EF4444' : 'none',
                    }}
                    title={`${fmt12hWithDay(asgn.start)} – ${fmt12h(asgn.end)}\n${formatGbp(asgn.costGbp)} · ${formatCo2(asgn.co2Kg)} CO₂`}
                  >
                    <span className="truncate px-1 hidden sm:block">{fmt12h(asgn.start)}</span>
                  </div>
                )}
                {!asgn && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-[var(--text-muted)]">
                    Not scheduled
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────
const CO2_EQUIV = [
  { label: 'km by car', factor: 1 / 0.120, icon: '🚗' },
  { label: 'hrs laptop', factor: 1 / 0.003, icon: '💻' },
];

function PlanSummary({ result, planUrl }: { result: { totalCostGbp: number; totalCo2Kg: number; totalSavingGbp: number; totalSavingCo2Kg: number } | null; planUrl: string }) {
  if (!result) return null;
  const { totalCostGbp, totalCo2Kg, totalSavingGbp, totalSavingCo2Kg } = result;
  const savingG = totalSavingCo2Kg * 1000;
  const eq = CO2_EQUIV.map((e) => ({ ...e, val: savingG * e.factor }));

  async function handleShare() {
    try {
      if (navigator.share) await navigator.share({ title: 'My EnergySaver Plan', url: planUrl });
      else await navigator.clipboard.writeText(planUrl);
    } catch { /* cancelled */ }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Plan summary</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total cost" value={formatGbp(totalCostGbp)} />
        <Stat label="Total CO₂" value={formatCo2(totalCo2Kg)} />
        <Stat label="Cost saved" value={formatGbp(totalSavingGbp)} accent />
        <Stat label="CO₂ saved" value={formatCo2(totalSavingCo2Kg)} accent />
      </div>
      {totalSavingCo2Kg > 0 && (
        <div className="flex flex-wrap gap-2">
          {eq.map((e) => (
            <span key={e.label} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text-muted)]">
              <span aria-hidden>{e.icon}</span>
              ≈ <strong className="text-[#9bc400]">{e.val < 10 ? e.val.toFixed(1) : Math.round(e.val)}</strong> {e.label}
            </span>
          ))}
        </div>
      )}
      <button onClick={handleShare}
        className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Share plan
      </button>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] px-3 py-2">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className={`font-mono font-bold text-sm mt-0.5 ${accent ? 'text-[#9bc400]' : 'text-[var(--text)]'}`}>{value}</p>
    </div>
  );
}

// ─── Main island ─────────────────────────────────────────────────────────────
export function PlannerIsland() {
  const router = useRouter();
  const params = useSearchParams();

  const [customAppliances, setCustomAppliances] = useState<Appliance[]>([]);
  useEffect(() => { setCustomAppliances(getCustomAppliances()); }, []);

  const ALL_APPLIANCES = [...STATIC_APPLIANCES, ...customAppliances];

  // Parse URL state
  const [tariffId, setTariffId] = useState(params.get('tariff') ?? 'flat-standard');
  const [postcode, setPostcode] = useState(params.get('postcode') ?? '');

  function parseItemsFromUrl(): PlanItem[] {
    const raw = params.get('appliances') ?? '';
    return raw.split(',').flatMap((part) => {
      const [id, wStr] = part.split(':');
      const appliance = ALL_APPLIANCES.find((a) => a.id === id);
      if (!appliance) return [];
      return [{ appliance, weight: parseFloat(wStr ?? '0.5') || 0.5 }];
    });
  }

  const [items, setItems] = useState<PlanItem[]>([]);
  // Initialise from URL after custom appliances are loaded
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    setItems(parseItemsFromUrl());
  }, [customAppliances]); // intentional one-shot init on first load

  const [slots, setSlots] = useState<MergedSlot[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [planResult, setPlanResult] = useState<ReturnType<typeof schedulePlan> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Custom appliance form state
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customKw, setCustomKw] = useState('');
  const [customHours, setCustomHours] = useState('');

  // Persist to URL
  function pushUrl(nextItems: PlanItem[], nextTariff: string, nextPostcode: string) {
    const appStr = nextItems.map((it) => `${it.appliance.id}:${it.weight.toFixed(2)}`).join(',');
    const q = new URLSearchParams();
    if (appStr) q.set('appliances', appStr);
    if (nextTariff !== 'flat-standard') q.set('tariff', nextTariff);
    if (nextPostcode) q.set('postcode', nextPostcode);
    router.replace(`/planner?${q.toString()}`, { scroll: false });
  }

  // Fetch slots + run plan
  const runPlan = useCallback(async (planItems: PlanItem[], pcode: string, tId: string) => {
    if (!planItems.length) { setSlots([]); setAssignments([]); setPlanResult(null); return; }
    setLoading(true); setError('');
    try {
      const tariff = TARIFFS.find((t) => t.id === tId) ?? TARIFFS[0]!;
      const region = lookupRegion(pcode);
      const gsp = region?.gspLetter;
      const now = new Date().toISOString();
      const until = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

      const [carbon, agile] = await Promise.all([
        getCarbonForecast(pcode),
        gsp ? getAgileRates(gsp, now, until).catch(() => []) : Promise.resolve([]),
      ]);
      const merged = mergeSlots(carbon, agile, tariff);
      setSlots(merged);

      const schedInput = {
        items: planItems.map((it) => ({ ...it, applianceId: it.appliance.id })),
        slots: merged,
        tariff,
      };
      const result = schedulePlan(schedInput);
      setAssignments(result.assignments);
      setPlanResult(result);
    } catch {
      setError('Failed to load forecast data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-run whenever inputs change (debounced 200ms)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void runPlan(items, postcode, tariffId);
    }, 200);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [items, postcode, tariffId, runPlan]);

  function addAppliance(id: string) {
    const appliance = ALL_APPLIANCES.find((a) => a.id === id);
    if (!appliance || items.some((it) => it.appliance.id === id)) return;
    const next = [...items, { appliance, weight: 0.5 }];
    setItems(next);
    pushUrl(next, tariffId, postcode);
  }

  function removeAppliance(id: string) {
    const next = items.filter((it) => it.appliance.id !== id);
    setItems(next);
    pushUrl(next, tariffId, postcode);
  }

  function updateWeight(id: string, weight: number) {
    const next = items.map((it) => it.appliance.id === id ? { ...it, weight } : it);
    setItems(next);
    pushUrl(next, tariffId, postcode);
  }

  function addCustomAppliance() {
    const kw = parseFloat(customKw);
    const hours = parseFloat(customHours);
    if (!customName.trim() || isNaN(kw) || kw <= 0 || isNaN(hours) || hours <= 0) return;
    const id = `custom-${Date.now()}`;
    const newAppliance: Appliance = {
      id,
      name: customName.trim(),
      category: 'custom',
      powerKw: kw,
      defaultRunHours: hours,
      contentHash: '',
    };
    const updated = [...customAppliances, newAppliance];
    setCustomAppliances(updated);
    saveCustomAppliances(updated);
    const next = [...items, { appliance: newAppliance, weight: 0.5 }];
    setItems(next);
    pushUrl(next, tariffId, postcode);
    setCustomName(''); setCustomKw(''); setCustomHours('');
    setShowCustomForm(false);
  }

  function deleteCustomAppliance(id: string) {
    const updated = customAppliances.filter((a) => a.id !== id);
    setCustomAppliances(updated);
    saveCustomAppliances(updated);
    removeAppliance(id);
  }

  // Group appliances by category for the select dropdown
  const categories = Object.keys(CATEGORY_LABELS);
  const grouped = categories.reduce<Record<string, Appliance[]>>((acc, cat) => {
    const list = ALL_APPLIANCES.filter((a) => a.category === cat && !items.some((it) => it.appliance.id === a.id));
    if (list.length) acc[cat] = list;
    return acc;
  }, {});

  const planUrl = typeof window !== 'undefined' ? window.location.href : '/planner';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text)]">Day Planner</h1>
        <p className="text-[var(--text-muted)] mt-1">Add appliances to get a conflict-free schedule optimised for your tariff and local carbon intensity.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Add appliance */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-3">
            <p className="text-sm font-semibold text-[var(--text)]">Add appliance</p>

            {/* Grouped select */}
            <select
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] px-3 py-2 text-sm"
              value=""
              onChange={(e) => { if (e.target.value) addAppliance(e.target.value); }}
              aria-label="Select appliance to add"
            >
              <option value="" disabled>Select appliance…</option>
              {Object.entries(grouped).map(([cat, list]) => (
                <optgroup key={cat} label={CATEGORY_LABELS[cat] ?? cat}>
                  {list.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} · {a.powerKw} kW</option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* Custom appliance toggle */}
            <button
              type="button"
              onClick={() => setShowCustomForm((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider px-3 py-2 rounded-lg border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-[#9bc400] hover:text-[#9bc400] transition-colors"
            >
              <span>+ Add custom appliance</span>
              <span className={`transition-transform ${showCustomForm ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {showCustomForm && (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  placeholder="Appliance name (e.g. Garden Lights)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] px-3 py-2 text-sm"
                  maxLength={60}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1">Power (kW)</label>
                    <input
                      type="number"
                      placeholder="e.g. 1.5"
                      value={customKw}
                      onChange={(e) => setCustomKw(e.target.value)}
                      min="0.01" max="100" step="0.05"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1">Run time (h)</label>
                    <input
                      type="number"
                      placeholder="e.g. 2"
                      value={customHours}
                      onChange={(e) => setCustomHours(e.target.value)}
                      min="0.25" max="24" step="0.25"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addCustomAppliance}
                  disabled={!customName.trim() || !customKw || !customHours}
                  className="w-full rounded-lg py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                  style={{ background: '#9bc400' }}
                >
                  Add to plan
                </button>
              </div>
            )}

            {/* Settings */}
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">Your postcode</label>
              <input
                type="text"
                placeholder="e.g. SW1A"
                value={postcode}
                onChange={(e) => { setPostcode(e.target.value); pushUrl(items, tariffId, e.target.value); }}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">Electricity tariff</label>
              <select
                value={tariffId}
                onChange={(e) => { setTariffId(e.target.value); pushUrl(items, e.target.value, postcode); }}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] px-3 py-2 text-sm"
              >
                {TARIFFS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {/* Plan items */}
          {items.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] px-1">No appliances in plan yet. Add one above.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const asgn = assignments.find((a) => a.applianceId === item.appliance.id);
                const isCustom = item.appliance.category === 'custom';
                return (
                  <div key={item.appliance.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-[var(--text)] flex items-center gap-1.5">
                          {item.appliance.name}
                          {isCustom && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide" style={{ background: '#f4f1f8', color: '#8076a3' }}>custom</span>}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">{item.appliance.powerKw} kW · {item.appliance.defaultRunHours}h</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isCustom && (
                          <button
                            onClick={() => deleteCustomAppliance(item.appliance.id)}
                            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors px-1"
                            title="Delete custom appliance"
                            aria-label={`Delete custom appliance ${item.appliance.name}`}
                          >
                            🗑
                          </button>
                        )}
                        <button
                          onClick={() => removeAppliance(item.appliance.id)}
                          className="text-[var(--text-muted)] hover:text-[var(--danger)] text-xs transition-colors"
                          aria-label={`Remove ${item.appliance.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Weight slider */}
                    <div>
                      <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                        <span>💰 Cheapest</span>
                        <span>🌿 Greenest</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.05" value={item.weight}
                        onChange={(e) => updateWeight(item.appliance.id, parseFloat(e.target.value))}
                        className="w-full accent-[var(--accent)]"
                        aria-label={`${item.appliance.name} priority: ${item.weight < 0.4 ? 'cheapest' : item.weight > 0.6 ? 'greenest' : 'balanced'}`}
                      />
                    </div>

                    {asgn && (
                      <div className="text-xs rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] px-2 py-1.5 space-y-0.5">
                        <p className="font-mono font-semibold text-[var(--accent)]">
                          {fmt12hWithDay(asgn.start)} – {fmt12h(asgn.end)}
                        </p>
                        <p className="text-[var(--text-muted)]">{formatGbp(asgn.costGbp)} · {formatCo2(asgn.co2Kg)} CO₂</p>
                        {asgn.overlaps && (
                          <p className="text-[var(--warning)]">⚠ Overlap with another appliance</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Main panel */}
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {loading && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 animate-pulse h-48" role="status" aria-label="Running plan…" />
          )}

          {!loading && slots.length > 0 && items.length > 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Schedule</p>
              <PlannerGantt items={items} assignments={assignments} slots={slots} />
            </div>
          )}

          {!loading && planResult && <PlanSummary result={planResult} planUrl={planUrl} />}

          {!loading && !items.length && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-12 text-center">
              <p className="text-4xl mb-3" aria-hidden>📋</p>
              <p className="font-semibold text-[var(--text)]">Your plan is empty</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">Add an appliance from the sidebar to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
