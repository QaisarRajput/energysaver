'use client';

/**
 * NotificationBanner — in-app toaster that appears when a scheduled notification fires
 * while the tab is open. Slides up from the bottom-right, auto-dismisses after 30s.
 */
import { useEffect, useState } from 'react';
import type { ScheduledNotification } from '../lib/notification-scheduler';
import { rehydrateNotifications } from '../lib/notification-scheduler';
import { fmt12hWithDay } from '../lib/format-time';

interface BannerData {
  applianceName: string;
  startIso: string;
  leadMinutes: number;
}

export function NotificationBanner() {
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleFire(n: ScheduledNotification) {
      setBanner({ applianceName: n.applianceName, startIso: n.startIso, leadMinutes: n.leadMinutes });
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 30_000);
      return () => clearTimeout(t);
    }

    rehydrateNotifications(handleFire);
  }, []);

  if (!banner || !visible) return null;

  const isNow = banner.leadMinutes === 0;

  return (
    <div
      role="alertdialog"
      aria-live="polite"
      aria-label={`${banner.applianceName} reminder`}
      className="fixed bottom-6 right-6 z-50 w-80 glass rounded-2xl border border-[var(--glass-border)] p-4 shadow-2xl animate-[slideUp_0.3s_ease-out]"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0" aria-hidden>{isNow ? '⚡' : '⏰'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--text)] text-sm">
            {isNow ? `Start your ${banner.applianceName} now!` : `${banner.applianceName} in 1 hour`}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {isNow
              ? 'Your cheapest, greenest window is open right now.'
              : `Optimal window opens at ${fmt12hWithDay(banner.startIso)}`
            }
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-[var(--text-muted)] hover:text-[var(--text)] shrink-0"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      {isNow && (
        <div className="flex gap-2 mt-3">
          <a
            href="/calculator"
            className="flex-1 text-center text-xs py-1.5 rounded-lg bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] transition-colors"
          >
            Open calculator
          </a>
          <button
            onClick={() => setVisible(false)}
            className="flex-1 text-xs py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
