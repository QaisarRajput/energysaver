/**
 * AffiliateCard — renders a smart-plug recommendation with affiliate link.
 * Hidden when config.monetization.affiliateTag is empty (never a dead link).
 */
import { siteConfig } from '../config/site';

interface Props {
  /** Product display name */
  productName: string;
  /** Base product URL — affiliate tag is appended from config */
  baseUrl: string;
  /** Short description line */
  description: string;
}

export function AffiliateCard({ productName, baseUrl, description }: Props) {
  const tag = siteConfig.monetization.affiliateTag;
  if (!tag) return null;

  // Append affiliate tag as query param
  const sep = baseUrl.includes('?') ? '&' : '?';
  const href = `${baseUrl}${sep}tag=${encodeURIComponent(tag)}`;

  // Safety: validate the constructed href uses https
  let safeHref: string;
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== 'https:') return null;
    safeHref = parsed.toString();
  } catch {
    return null;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <p className="text-sm font-medium text-[var(--text)]">{productName}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">{description}</p>
      <a
        href={safeHref}
        rel="sponsored noopener noreferrer"
        target="_blank"
        className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
      >
        Shop ↗
      </a>
      <p className="text-xs text-[var(--text-muted)] mt-2">
        Affiliate link — we may earn a small commission.
      </p>
    </div>
  );
}
