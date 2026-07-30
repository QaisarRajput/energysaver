import type { Metadata } from 'next';
import { siteConfig } from '../../config/site';
import { CalculatorShell } from '../../components/CalculatorShell';

export const metadata: Metadata = {
  title: 'Calculator',
  description:
    'Find the cheapest, lowest-carbon time to run your appliances. Enter your postcode, pick your appliance, and get a personalised recommendation.',
  openGraph: {
    title: `Calculator | ${siteConfig.site.name}`,
    description:
      'Find the cheapest, lowest-carbon time to run your appliances.',
    url: `${siteConfig.site.url}/calculator`,
  },
};

export default function CalculatorPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 md:px-10 py-12">
      <p className="eyebrow mb-2">Smart Planning</p>
      <h1 className="text-4xl md:text-5xl font-black mb-3" style={{ color: '#2d2640', letterSpacing: '-0.02em' }}>Energy Timer Calculator</h1>
      <p className="mb-10 text-base" style={{ color: '#7c677f', maxWidth: '36rem' }}>
        Pick your appliance, enter your postcode, and we&apos;ll find the cheapest and greenest
        time to run it in the next 48 hours.
      </p>
      <CalculatorShell />
    </main>
  );
}
