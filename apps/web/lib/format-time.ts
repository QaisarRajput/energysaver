/** Shared 12h time formatting utilities. All output in Europe/London local time. */

/** "2:30 am" */
export function fmt12h(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Europe/London',
  });
}

/** "Fri 2:30 am" */
export function fmt12hWithDay(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Europe/London',
  });
}

/** "Fri 2:30 am – 4:00 am" */
export function fmt12hRange(fromIso: string, toIso: string): string {
  return `${fmt12hWithDay(fromIso)} – ${fmt12h(toIso)}`;
}

/** "Fri, 25 Jul" */
export function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/London',
  });
}
