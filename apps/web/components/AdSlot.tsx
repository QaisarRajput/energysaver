/**
 * AdSlot — renders an AdSense unit only when publisherId is set AND ready===true.
 * Stays entirely dormant (renders nothing) during this phase.
 *
 * ponytail: no live AdSense rendering until config.adsense.ready is true.
 * When enabled, load the AdSense script once in layout.tsx and render
 * <ins class="adsbygoogle"> elements here.
 */
'use client';

import { adsenseIds } from '../config/site';

interface Props {
  slot: string;
  format?: 'auto' | 'rectangle' | 'horizontal';
  className?: string;
}

export function AdSlot({ slot, format = 'auto', className }: Props) {
  const ids = adsenseIds();
  if (!ids) return null;

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ids.publisherId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
