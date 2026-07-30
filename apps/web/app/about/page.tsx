import type { Metadata } from 'next';
import { siteConfig } from '../../config/site';

export const metadata: Metadata = {
  title: 'About',
  description: `About ${siteConfig.site.name} — the free UK energy timing tool.`,
};

export default function AboutPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[var(--text)] mb-6">About EnergySaver</h1>
      <div className="prose prose-neutral dark:prose-invert max-w-none text-[var(--text)] space-y-4">
        <p>
          EnergySaver is a free tool that helps UK households run their flexible appliances —
          dryers, dishwashers, washing machines, EV chargers — at the cheapest and lowest-carbon
          time of day.
        </p>
        <p>
          It works by combining two public data sources: the National Energy System Operator
          (NESO) Carbon Intensity API, which forecasts how green the grid will be in your area
          for the next 48 hours, and Octopus Energy&apos;s Agile tariff API for live half-hourly
          electricity prices.
        </p>
        <p>
          Everything runs in your browser. No data is sent to our servers. Your postcode is used
          only to look up your grid region — it is never stored or transmitted beyond your device.
        </p>
        <p>
          EnergySaver is built as a static web app hosted on GitHub Pages.
        </p>
        <p>
          Questions? Reach us at{' '}
          <a
            href={`mailto:${siteConfig.site.contactEmail}`}
            className="text-[var(--accent)] underline"
          >
            {siteConfig.site.contactEmail}
          </a>
          .
        </p>
      </div>
    </main>
  );
}
