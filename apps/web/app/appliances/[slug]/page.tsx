import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import appliancesRaw from '../../../../../data/appliances.json';
import { ApplianceSchema } from '@energysaver/schema';
import type { Appliance } from '@energysaver/schema';
import { siteConfig } from '../../../config/site';
import { SavingsResultIsland } from '../../../components/SavingsResultIsland';

const appliances: Appliance[] = (appliancesRaw as unknown[]).flatMap((a) => {
  const r = ApplianceSchema.safeParse(a);
  return r.success ? [r.data] : [];
});

export function generateStaticParams(): { slug: string }[] {
  return appliances.map((a) => ({ slug: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const appliance = appliances.find((a) => a.id === slug);
  if (!appliance) return {};
  return {
    title: appliance.name,
    description: `Find the cheapest and greenest time to run your ${appliance.name}. Powered by live UK carbon intensity and electricity prices.`,
    openGraph: {
      title: `${appliance.name} | ${siteConfig.site.name}`,
      url: `${siteConfig.site.url}/appliances/${slug}`,
    },
  };
}

export default async function ApplianceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const appliance = appliances.find((a) => a.id === slug);
  if (!appliance) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Best time to run your ${appliance.name}`,
    description: appliance.description,
    url: `${siteConfig.site.url}/appliances/${appliance.id}`,
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-sm text-[var(--text-muted)] mb-6">
        <Link href="/appliances" className="hover:text-[var(--accent)]">
          ← All appliances
        </Link>
      </nav>

      <h1 className="text-3xl font-bold text-[var(--text)] mb-2">{appliance.name}</h1>
      {appliance.description && (
        <p className="text-[var(--text-muted)] mb-6">{appliance.description}</p>
      )}

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <dt className="text-xs text-[var(--text-muted)]">Typical power</dt>
          <dd className="text-xl font-mono font-bold text-[var(--text)] mt-1">{appliance.powerKw} kW</dd>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <dt className="text-xs text-[var(--text-muted)]">Typical run</dt>
          <dd className="text-xl font-mono font-bold text-[var(--text)] mt-1">{appliance.defaultRunHours}h</dd>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <dt className="text-xs text-[var(--text-muted)]">Category</dt>
          <dd className="text-xl font-semibold text-[var(--text)] mt-1 capitalize">{appliance.category}</dd>
        </div>
      </dl>

      <h2 className="text-xl font-semibold text-[var(--text)] mb-4">Best time to run it</h2>
      <SavingsResultIsland appliance={appliance} />

      {appliance.affiliateProductUrl && (
        <div className="mt-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          <p className="text-sm text-[var(--text)] mb-2">
            Consider pairing with a smart plug so your {appliance.name.toLowerCase()} starts automatically at the recommended time.
          </p>
          <a
            href={appliance.affiliateProductUrl}
            rel="sponsored noopener noreferrer"
            target="_blank"
            className="inline-flex items-center px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            Shop smart plugs ↗
          </a>
          <p className="text-xs text-[var(--text-muted)] mt-2">Affiliate link — we may earn a small commission.</p>
        </div>
      )}
    </main>
  );
}
