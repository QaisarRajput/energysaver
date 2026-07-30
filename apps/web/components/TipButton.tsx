'use client';

import { siteConfig } from '../config/site';

/**
 * TipButton — renders a support/tip link when config.monetization.tipUrl is set.
 * Gracefully hidden (returns null) when the URL is not configured.
 */
export function TipButton({ className }: { className?: string }) {
  const url = siteConfig.monetization.tipUrl;
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--accent)] text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent)] hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${className ?? ''}`}
    >
      ☕ Support this tool
    </a>
  );
}
