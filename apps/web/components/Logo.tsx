'use client';

interface Props {
  size?: 'sm' | 'lg';
  className?: string;
}

/**
 * EnergySaver wordmark logo — Carbonex-inspired.
 * Purple clock mark with green leaf + bold purple/green wordmark.
 */
export function Logo({ size = 'sm', className = '' }: Props) {
  const h = size === 'sm' ? 32 : 44;

  return (
    <span
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      aria-label="EnergySaver"
    >
      <svg width={h} height={h} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="24" cy="24" r="21" stroke="#8076a3" strokeWidth="2.5" />
        <path d="M24 24 C19 17 21 9 33 8 C34.5 20 29 25 24 24Z" fill="#9bc400" />
        <line x1="24" y1="24" x2="24" y2="7" stroke="#8076a3" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="24" y1="24" x2="37" y2="24" stroke="#8076a3" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="3" fill="#8076a3" />
      </svg>
      <span style={{ fontSize: size === 'sm' ? '15px' : '22px', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.02em', color: '#8076a3' }}>
        Energy<span style={{ color: '#9bc400' }}>Saver</span>
      </span>
    </span>
  );
}

