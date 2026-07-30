/**
 * notification-scheduler.ts
 *
 * Schedules browser notifications for appliance run windows.
 * Uses window.setTimeout — fires while the tab is open.
 * Persists scheduled items to localStorage so they survive soft refreshes.
 *
 * ponytail: for true background notifications (even when browser is closed),
 * a VAPID push server + service worker push subscription is required.
 * That is a separate backend infrastructure concern and is deferred.
 * The Periodic Background Sync API (Chrome only) is registered as a
 * progressive enhancement in sw.js but requires a VAPID endpoint.
 */

export interface ScheduledNotification {
  id: string;
  applianceId: string;
  applianceName: string;
  startIso: string;
  leadMinutes: number; // 60 = "1 hour before", 0 = "now"
  scheduledAtMs: number; // when the notification should fire
  createdAt: string;
}

const STORAGE_KEY = 'energysaver:notifications';
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function load(): ScheduledNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as ScheduledNotification[];
  } catch {
    return [];
  }
}

function save(items: ScheduledNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* quota exceeded — ignore */ }
}

export function getScheduled(): ScheduledNotification[] {
  return load().filter((n) => n.scheduledAtMs > Date.now());
}

export function cancelNotification(id: string) {
  const timer = timers.get(id);
  if (timer) { clearTimeout(timer); timers.delete(id); }
  save(load().filter((n) => n.id !== id));
}

export function scheduleNotification(
  applianceId: string,
  applianceName: string,
  startIso: string,
  leadMinutes: number,
  onFire?: (n: ScheduledNotification) => void
): ScheduledNotification | null {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;

  const fireAtMs = new Date(startIso).getTime() - leadMinutes * 60 * 1000;
  const delayMs = fireAtMs - Date.now();

  // Don't schedule if already past
  if (delayMs < -30_000) return null;

  const id = `${applianceId}:${startIso}:${leadMinutes}`;

  // Cancel any existing for this id
  cancelNotification(id);

  const notification: ScheduledNotification = {
    id, applianceId, applianceName, startIso, leadMinutes,
    scheduledAtMs: fireAtMs,
    createdAt: new Date().toISOString(),
  };

  // Persist
  const existing = load().filter((n) => n.id !== id);
  save([...existing, notification]);

  // Arm timer
  const timer = setTimeout(() => {
    // OS notification
    const title = leadMinutes > 0
      ? `⚡ ${applianceName} in ${leadMinutes} minutes`
      : `⚡ Start your ${applianceName} now!`;
    const body = leadMinutes > 0
      ? `Your optimal window opens in ${leadMinutes} minutes — get it ready!`
      : `Your cheapest, greenest window is open right now.`;

    try {
      new Notification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: id,
        requireInteraction: leadMinutes === 0,
      });
    } catch { /* Notification API not available in this context */ }

    // Trigger in-app banner callback
    onFire?.(notification);

    // Remove from storage
    save(load().filter((n) => n.id !== id));
    timers.delete(id);
  }, Math.max(0, delayMs));

  timers.set(id, timer);
  return notification;
}

/** Re-arm any persisted notifications after a page load (tab reload/re-open). */
export function rehydrateNotifications(
  onFire?: (n: ScheduledNotification) => void
) {
  const pending = getScheduled();
  for (const n of pending) {
    scheduleNotification(n.applianceId, n.applianceName, n.startIso, n.leadMinutes, onFire);
  }
}

/** Cancel all notifications for a given appliance. */
export function cancelForAppliance(applianceId: string) {
  const all = load();
  all.filter((n) => n.applianceId === applianceId).forEach((n) => cancelNotification(n.id));
}
