import type { Metadata } from 'next';
import tariffsRaw from '../../../../data/tariffs.json';
import { TariffPresetSchema } from '@energysaver/schema';
import type { TariffPreset } from '@energysaver/schema';

export const metadata: Metadata = {
  title: 'UK Electricity Tariffs Explained',
  description:
    'Understand Economy 7, Economy 10, Octopus Go, Octopus Agile and flat-rate tariffs — and how to pick the right one for load-shifting.',
};

const tariffs: TariffPreset[] = (tariffsRaw as unknown[]).flatMap((t) => {
  const r = TariffPresetSchema.safeParse(t);
  return r.success ? [r.data] : [];
});

export default function TariffsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[var(--text)] mb-4">UK electricity tariffs explained</h1>
      <p className="text-[var(--text-muted)] mb-8">
        Not all electricity tariffs are created equal. Time-of-use tariffs reward you for shifting
        flexible loads (dryers, dishwashers, EV charging) to cheaper, greener off-peak hours.
      </p>

      <div className="space-y-6">
        {tariffs.map((t) => (
          <section key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
            <h2 className="text-xl font-semibold text-[var(--text)]">{t.name}</h2>
            <p className="text-[var(--text-muted)] mt-1 text-sm">{t.description}</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[var(--bg)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--text-muted)]">Peak rate</p>
                <p className="font-mono font-semibold text-[var(--text)]">{t.peakRateP}p/kWh</p>
              </div>
              <div className="rounded-lg bg-[var(--bg)] border border-[var(--border)] px-3 py-2">
                <p className="text-xs text-[var(--text-muted)]">Off-peak rate</p>
                <p className="font-mono font-semibold text-[var(--accent)]">{t.offPeakRateP}p/kWh</p>
              </div>
            </div>

            {t.windows.length > 1 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Time windows</p>
                <ul className="space-y-1">
                  {t.windows.map((w, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${w.label === 'off-peak' ? 'bg-[var(--accent)]' : 'bg-[var(--text-muted)]'}`}
                        aria-hidden
                      />
                      <span className="font-mono text-xs text-[var(--text-muted)]">
                        {w.startHhMm}–{w.endHhMm}
                      </span>
                      <span className="text-[var(--text)] capitalize">{w.label}</span>
                      <span className="ml-auto font-mono text-xs">{w.rateP}p</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="mt-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-muted)]">
        <strong className="text-[var(--text)]">Note:</strong> Rates shown are indicative illustrative
        estimates based on published typical values. Always check your own supplier&apos;s terms for
        exact rates. These figures are not billing-accurate.
      </div>
    </main>
  );
}
