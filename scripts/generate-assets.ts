/**
 * Generates PWA icons and OG social images at build time.
 * Run via: node scripts/generate-assets.mjs
 * Outputs to: apps/web/public/icons/ and apps/web/public/og/
 *
 * ponytail: uses @napi-rs/canvas for icon generation. SVG wordmark drawn
 * programmatically — no external font files required at build time.
 */
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '../apps/web/public');

mkdirSync(resolve(PUBLIC, 'icons'), { recursive: true });
mkdirSync(resolve(PUBLIC, 'og'), { recursive: true });

const ACCENT = '#2FBF71';
const BG = '#0F1117';
const WHITE = '#FFFFFF';

/** Draw the EnergySaver icon: dark bg + accent leaf/bolt motif + text */
function drawIcon(size: number, maskable = false): Buffer {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const pad = maskable ? size * 0.15 : size * 0.05;
  const inner = size - pad * 2;

  // Background
  ctx.fillStyle = maskable ? ACCENT : BG;
  ctx.fillRect(0, 0, size, size);

  if (!maskable) {
    // Rounded-rect clip for non-maskable
    const r = size * 0.2;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = BG;
    ctx.fill();
  }

  // Leaf/bolt symbol — stylised lightning bolt in accent colour
  const cx = size / 2;
  const cy = size / 2;
  const s = inner * 0.42;

  ctx.fillStyle = maskable ? WHITE : ACCENT;
  ctx.beginPath();
  // Simple lightning bolt path
  ctx.moveTo(cx + s * 0.1, cy - s);
  ctx.lineTo(cx - s * 0.4, cy + s * 0.05);
  ctx.lineTo(cx + s * 0.05, cy + s * 0.05);
  ctx.lineTo(cx - s * 0.1, cy + s);
  ctx.lineTo(cx + s * 0.4, cy - s * 0.05);
  ctx.lineTo(cx - s * 0.05, cy - s * 0.05);
  ctx.closePath();
  ctx.fill();

  return canvas.toBuffer('image/png');
}

/** Draw the 1200×630 OG social banner */
function drawOgBanner(): Buffer {
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0F1117');
  grad.addColorStop(1, '#1A2B20');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Accent strip at bottom
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, H - 6, W, 6);

  // Lightning bolt — large, right side
  const bx = W * 0.82;
  const by = H * 0.5;
  const bs = 180;
  ctx.fillStyle = `${ACCENT}33`;
  ctx.beginPath();
  ctx.moveTo(bx + bs * 0.1, by - bs);
  ctx.lineTo(bx - bs * 0.4, by + bs * 0.05);
  ctx.lineTo(bx + bs * 0.05, by + bs * 0.05);
  ctx.lineTo(bx - bs * 0.1, by + bs);
  ctx.lineTo(bx + bs * 0.4, by - bs * 0.05);
  ctx.lineTo(bx - bs * 0.05, by - bs * 0.05);
  ctx.closePath();
  ctx.fill();

  // Site name
  ctx.fillStyle = WHITE;
  ctx.font = `bold ${72}px sans-serif`;
  ctx.fillText('EnergySaver', 80, 180);

  // Tagline
  ctx.fillStyle = ACCENT;
  ctx.font = `${36}px sans-serif`;
  ctx.fillText('Cheapest · Greenest · Right now', 80, 250);

  // Domain
  ctx.fillStyle = '#6B7280';
  ctx.font = `${28}px sans-serif`;
  ctx.fillText('energysaver.hubs.dpdns.org', 80, H - 50);

  return canvas.toBuffer('image/png');
}

// Generate icons
const sizes = [192, 512] as const;
for (const size of sizes) {
  writeFileSync(resolve(PUBLIC, `icons/icon-${size}.png`), drawIcon(size, false));
  console.log(`✓ icons/icon-${size}.png`);
}
writeFileSync(resolve(PUBLIC, 'icons/icon-maskable-512.png'), drawIcon(512, true));
console.log('✓ icons/icon-maskable-512.png');

// Apple touch icon (180px)
writeFileSync(resolve(PUBLIC, 'icons/apple-touch-icon.png'), drawIcon(180, false));
console.log('✓ icons/apple-touch-icon.png');

// OG banner
writeFileSync(resolve(PUBLIC, 'og/home.png'), drawOgBanner());
console.log('✓ og/home.png');

console.log('\nAsset generation complete.');
