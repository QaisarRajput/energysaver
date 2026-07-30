import type { Metadata } from 'next';
import Link from 'next/link';
import appliancesRaw from '../../../../data/appliances.json';
import { ApplianceSchema } from '@energysaver/schema';
import type { Appliance } from '@energysaver/schema';

export const metadata: Metadata = {
  title: 'Appliances',
  description: 'Browse all supported appliances and find the best time to run each one.',
};

const appliances: Appliance[] = (appliancesRaw as unknown[]).flatMap((a) => {
  const r = ApplianceSchema.safeParse(a);
  return r.success ? [r.data] : [];
});

const categories = [...new Set(appliances.map((a) => a.category))];

export default function AppliancesPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[var(--text)] mb-2">Appliances</h1>
      <p className="text-[var(--text-muted)] mb-8">
        Pick an appliance to see when it&apos;s cheapest and greenest to run.
      </p>

      {categories.map((cat) => (
        <section key={cat} className="mb-10">
          <h2 className="text-lg font-semibold text-[var(--text)] capitalize mb-4 border-b border-[var(--border)] pb-2">
            {cat}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0">
            {appliances
              .filter((a) => a.category === cat)
              .map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/appliances/${a.id}`}
                    className="block p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] transition-colors group"
                  >
                    <span className="block font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                      {a.name}
                    </span>
                    <span className="block text-sm text-[var(--text-muted)] mt-1 font-mono">
                      {a.powerKw} kW · {a.defaultRunHours}h typical
                    </span>
                    {a.description && (
                      <span className="block text-xs text-[var(--text-muted)] mt-2 line-clamp-2">
                        {a.description}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
