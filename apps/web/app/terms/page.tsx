import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms of use and methodology disclaimer for EnergySaver.',
};

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[var(--text)] mb-6">Terms of Use</h1>
      <div className="space-y-4 text-[var(--text-muted)] text-sm leading-relaxed">
        <p className="text-[var(--text)]">Last updated: July 2026</p>

        <h2 className="text-lg font-semibold text-[var(--text)]">Estimates, not billing advice</h2>
        <p>
          All cost and CO₂ savings figures shown on EnergySaver are <strong>illustrative estimates</strong>.
          They are based on typical published appliance wattage, indicative tariff rates, and the
          Carbon Intensity API forecast. They are not billing-accurate and should not be used for
          financial or energy purchasing decisions.
        </p>
        <p>
          Actual savings depend on your specific appliance model, your exact contracted tariff
          rates, your actual usage pattern, and real-time grid conditions which may differ from the
          forecast.
        </p>

        <h2 className="text-lg font-semibold text-[var(--text)]">Methodology</h2>
        <p>
          The recommendation engine identifies the contiguous half-hourly window (of your
          appliance&apos;s typical run duration) that minimises a weighted combination of
          normalised cost and normalised CO₂ across the next 48 hours. Cost is in pence/kWh;
          CO₂ is in grams CO₂-equivalent per kWh from the NESO Carbon Intensity API forecast.
          The &quot;saving vs baseline&quot; figure compares the recommended window against a
          default 17:00–20:00 evening peak window.
        </p>

        <h2 className="text-lg font-semibold text-[var(--text)]">Data sources</h2>
        <p>
          Carbon intensity data: National Energy System Operator Carbon Intensity API, licensed
          under CC BY 4.0. Electricity prices: Octopus Energy API (Agile tariff) or published
          indicative TOU presets. Both are subject to change without notice.
        </p>

        <h2 className="text-lg font-semibold text-[var(--text)]">Affiliate links</h2>
        <p>
          Some links to smart plugs and related products on this site are affiliate links. If you
          click them and make a purchase, we may earn a small commission at no extra cost to you.
          We only link to products relevant to the use case described on the page.
        </p>

        <h2 className="text-lg font-semibold text-[var(--text)]">Limitation of liability</h2>
        <p>
          EnergySaver is provided &quot;as is&quot; without warranty of any kind. We are not
          liable for any loss arising from reliance on estimates shown on this site.
        </p>
      </div>
    </main>
  );
}
