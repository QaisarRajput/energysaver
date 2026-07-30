import type { Metadata } from 'next';
import { Suspense } from 'react';
import { siteConfig } from '../../config/site';
import { PlannerPage as PlannerClient } from '../../components/PlannerPage';

export const metadata: Metadata = {
  title: `Day Planner — ${siteConfig.site.name}`,
  description:
    'Plan all your appliances for the cheapest, greenest day. Our constraint-aware scheduler finds non-overlapping optimal slots for every appliance in your home.',
  openGraph: {
    title: `Day Planner — ${siteConfig.site.name}`,
    description: 'Multi-appliance scheduler for the cheapest, greenest day.',
    url: `${siteConfig.site.url}/planner`,
  },
};

export default function PlannerPage() {
  return (
    <main>
      <Suspense>
        <PlannerClient />
      </Suspense>
    </main>
  );
}

