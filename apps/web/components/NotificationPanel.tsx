'use client';

/**
 * NotificationPanel — allows users to schedule browser notifications
 * for a recommended appliance window (1h before + at start time).
 */
import { useState, useEffect } from 'react';
import {
  scheduleNotification,
  cancelForAppliance,
  getScheduled,
} from '../lib/notification-scheduler';
import { fmt12hWithDay } from '../lib/format-time';

interface Props {
  applianceId: string;
  applianceName: string;
  recommendedStart: string;
}

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function NotificationPanel({ applianceId, applianceName, recommendedStart }: Props) {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [oneHour, setOneHour] = useState(true);
  const [atStart, setAtStart] = useState(true);
  const [scheduled, setScheduled] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!('Notification' in window)) { setPermission('unsupported'); return; }
    setPermission(Notification.permission as PermissionState);
    // Check if already scheduled
    const existing = getScheduled();
    const isActive = existing.some((n) => n.applianceId === applianceId);
    setScheduled(isActive);
  }, [applianceId]);

  if (permission === 'unsupported') return null;

  async function handleEnable() {
    setError('');
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      if (result !== 'granted') {
        setError('Notification permission denied. Enable it in your browser settings (🔒 site settings).');
        return;
      }
      arm();
    } catch {
      setError('Could not request notification permission.');
    }
  }

  function arm() {
    cancelForAppliance(applianceId);
    if (oneHour) scheduleNotification(applianceId, applianceName, recommendedStart, 60);
    if (atStart) scheduleNotification(applianceId, applianceName, recommendedStart, 0);
    setScheduled(true);
  }

  function handleCancel() {
    cancelForAppliance(applianceId);
    setScheduled(false);
  }

  const startTime = fmt12hWithDay(recommendedStart);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>🔔</span>
        <p className="text-sm font-semibold text-[var(--text)]">Get reminded when it's time</p>
      </div>

      {!scheduled ? (
        <>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={oneHour}
                onChange={(e) => setOneHour(e.target.checked)}
                className="accent-[var(--accent)] w-4 h-4 rounded"
              />
              <span className="text-sm text-[var(--text)]">1 hour before ({startTime})</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={atStart}
                onChange={(e) => setAtStart(e.target.checked)}
                className="accent-[var(--accent)] w-4 h-4 rounded"
              />
              <span className="text-sm text-[var(--text)]">When the window opens ({startTime})</span>
            </label>
          </div>

          {error && (
            <p className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          {permission === 'denied' && !error && (
            <p className="text-xs text-[var(--warning)]">
              Notifications are blocked. Open your browser's site settings (🔒) and allow notifications for this site.
            </p>
          )}

          <button
            onClick={permission === 'granted' ? arm : handleEnable}
            disabled={!oneHour && !atStart}
            className="w-full py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
          >
            {permission === 'granted' ? 'Enable reminders' : 'Allow & enable reminders'}
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-[#9bc400] flex items-center gap-1.5">
            <span aria-hidden>✓</span>
            Reminders set for {startTime}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Note: reminders only fire while this tab is open. Close and reopen the tab to re-arm.
          </p>
          <button
            onClick={handleCancel}
            className="text-xs text-[var(--danger)] hover:underline transition-colors"
          >
            Cancel reminders
          </button>
        </div>
      )}
    </div>
  );
}
