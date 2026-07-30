'use client';

/**
 * SavingsResultIsland — client-side widget for appliance detail pages.
 * Fetches carbon forecast, runs the engine, shows the recommendation.
 */
import { useState, useEffect } from 'react';
import type { Appliance, MergedSlot, Recommendation, TariffPreset } from '@energysaver/schema';
import tariffsRaw from '../../../data/tariffs.json';
import { TariffPresetSchema } from '@energysaver/schema';
import { getCarbonForecast } from '../lib/api-clients';
import { mergeSlots } from '../lib/merge-slots';
import { findBestWindow } from '../lib/find-best-window';
import { SavingsResult } from './SavingsResult';

const TARIFFS: TariffPreset[] = (tariffsRaw as unknown[]).flatMap((t) => {
  const r = TariffPresetSchema.safeParse(t);
  return r.success ? [r.data] : [];
});

const DEFAULT_TARIFF = TARIFFS.find((t) => t.id === 'flat-standard') ?? TARIFFS[0];

interface Props {
  appliance: Appliance;
}

export function SavingsResultIsland({ appliance }: Props) {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!DEFAULT_TARIFF) return;
    getCarbonForecast()
      .then((carbon) => {
        if (carbon.length === 0) {
          setError('Carbon data unavailable.');
          return;
        }
        const merged: MergedSlot[] = mergeSlots(carbon, [], DEFAULT_TARIFF);
        const runSlots = Math.max(1, Math.ceil(appliance.defaultRunHours / 0.5));
        const rec = findBestWindow({
          slots: merged,
          applianceId: appliance.id,
          powerKw: appliance.powerKw,
          runSlots,
          weight: 0.5,
        });
        setRecommendation(rec);
      })
      .catch(() => setError('Failed to load live data.'))
      .finally(() => setLoading(false));
  }, [appliance]);

  if (loading) {
    return (
      <div className="h-32 rounded-xl animate-pulse bg-[var(--border)]" role="status" aria-label="Loading recommendation" />
    );
  }

  if (error || !recommendation) {
    return <p className="text-sm text-[var(--text-muted)]">{error || 'No recommendation available.'}</p>;
  }

  return <SavingsResult recommendation={recommendation} appliance={appliance} />;
}
