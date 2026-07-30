/**
 * mergeSlots — joins a carbon forecast series and a price series on UTC `from` timestamps.
 * Missing price slots are filled from the TOU tariff preset and flagged as `priceEstimated: true`.
 */
import type { CarbonForecastSlot, AgileRate, MergedSlot, TariffPreset } from '@energysaver/schema';

/**
 * Determine the p/kWh price for a given UTC slot start from a TOU tariff preset.
 * Window `endHhMm < startHhMm` spans midnight (e.g. 07:30→00:30 is the peak window covering
 * 07:30–24:00 and 00:00–00:30).
 *
 * ponytail: compares HH:MM strings lexicographically — valid because all values share the same
 * zero-padded format. No date arithmetic needed for this single-day window check.
 */
function priceFromTou(fromUtc: string, tariff: TariffPreset): number {
  const date = new Date(fromUtc);
  // Format as HH:MM in UTC (not local time — TOU windows are expressed in local clock, but we
  // use UTC here as a consistent approximation for the fallback path, which is clearly labelled
  // as estimated. A precise local-time TOU lookup is a ponytail upgrade.
  const hhmm = date.toISOString().slice(11, 16); // 'HH:MM'

  for (const window of tariff.windows) {
    if (window.startHhMm <= window.endHhMm) {
      // Normal window (no midnight wrap)
      if (hhmm >= window.startHhMm && hhmm < window.endHhMm) {
        return window.rateP;
      }
    } else {
      // Midnight-spanning window e.g. 23:00→06:00
      if (hhmm >= window.startHhMm || hhmm < window.endHhMm) {
        return window.rateP;
      }
    }
  }

  return tariff.peakRateP; // fallback: peak rate
}

export function mergeSlots(
  carbon: CarbonForecastSlot[],
  agile: AgileRate[],
  tariffFallback: TariffPreset,
): MergedSlot[] {
  // Build a fast lookup map from slot UTC `from` → agile price
  const agileMap = new Map<string, number>();
  for (const rate of agile) {
    // Normalise ISO strings to the same format as carbon `from` keys
    agileMap.set(normaliseIso(rate.validFrom), rate.valueIncVat);
  }

  return carbon.map((slot): MergedSlot => {
    const key = normaliseIso(slot.from);
    const agilePrice = agileMap.get(key);
    const priceEstimated = agilePrice === undefined;
    const priceP = priceEstimated ? priceFromTou(slot.from, tariffFallback) : agilePrice;

    return {
      from: slot.from,
      to: slot.to,
      intensityForecast: slot.intensityForecast,
      intensityIndex: slot.intensityIndex,
      priceP,
      priceEstimated,
    };
  });
}

/** Normalise an ISO timestamp to 'YYYY-MM-DDTHH:MMZ' for keying. */
function normaliseIso(iso: string): string {
  // Accept 'YYYY-MM-DDTHH:MM+00:00', 'YYYY-MM-DDTHH:MMZ', etc.
  return iso.replace('+00:00', 'Z').slice(0, 16) + 'Z';
}
