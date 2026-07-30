'use client';

import dynamic from 'next/dynamic';

const PlannerIsland = dynamic(
  () => import('./PlannerIsland').then((m) => m.PlannerIsland),
  {
    ssr: false,
    loading: () => (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="h-96 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] animate-pulse" role="status" aria-label="Loading planner…" />
      </div>
    ),
  }
);

export function PlannerPage() {
  return <PlannerIsland />;
}
