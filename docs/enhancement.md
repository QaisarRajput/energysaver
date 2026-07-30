# Enhancement Plan — EnergySaver v2 "Grid-Smart Planner"

> Companion to `docs/implementation-plan.md`. Conforms to the same `docs/instructions.md` standard (v2). All §-references are to that standard unless prefixed §E (this document's own sections).
>
> **Scope:** Visual identity, richer data visualisations, multi-appliance day planner, PWA push notifications, real-time recalculation, and a full UX overhaul. None of these existed in v1. Every item here is explicitly requested or directly required to support a requested feature.

---

## §E0 — Gap analysis: v1 vs. the plan and the user's vision

### What v1 built correctly
- End-to-end data pipeline: Carbon Intensity API → `mergeSlots` → `findBestWindow` → `SavingsResult`
- 25 static pages build clean; URL-shareable calculator state; Zod-validated static data (131 records)
- 5 passing unit tests for the recommendation engine
- PWA manifest, service worker scaffold, GitHub Actions CI

### Critical gaps vs. §11 (design system)
| Gap | Detail |
|---|---|
| No site header or logo | Every page opens directly into content. `§11` requires a wordmark SVG and header. |
| No theme toggle | Dark-mode tokens exist and the FOUC-prevention script works, but there is no UI control to switch. |
| 24h time format everywhere | User explicitly requires 12h AM/PM. Every `toLocaleString` call outputs `21:30` not `9:30 PM`. |
| Design tokens too sparse | Missing `--surface-muted`, `--ring`, `--success`, `--warning`; no glassmorphism dark surfaces; no gradient tokens for the gauge. |
| Basic canvas sparkline | `TimelineChart` is a hand-drawn canvas line. No interactivity, no hover tooltip, no dual Y axes, no animation. |
| CarbonHeatmapRibbon | 48 flat divs in a row with no AM/PM grouping, no hover values, no labels, no interaction. |
| No CO₂ equivalences | The numbers are abstract. `218 g CO₂` needs a human scale: "≈ 1.5 km by car". |
| No logo asset | `§10` requires a programmatically-generated SVG wordmark (clock + leaf motif). |

### Features missing entirely
| Feature | User requirement |
|---|---|
| Multi-appliance Day Planner | "add list of appliances… make a plan… best usage slots" |
| Adjustable time windows | "allow them to change the time window… in realtime the calculations change" |
| Appliance schedule Gantt | Visual 48h timeline showing each appliance's optimal slot |
| PWA push notifications | "notify its the best time to run something in an hour and then when its actually the time" |
| 48h grid with AM/PM windows | "show next 48 hours but do make the 12 hour am pm window" |
| Price vs Carbon scatter | No scatter/bubble plot insight tab exists yet |
| Savings ticker animation | `§11` specifies an animated tick-up; not implemented |
| Share button | `§12` specifies `navigator.share()`; not wired |
| Navigation bar | No persistent nav between pages; users must use browser back |

---

## §E1 — Visual identity & navigation

### §E1.1 — SVG wordmark logo

**File:** `apps/web/components/Logo.tsx`

Hand-coded SVG. The mark is a stylised clock face where the hour/minute hands form a leaf: the 2-o'clock hand points to the right (representing energy flowing out) and the 10-o'clock hand curves upward (representing clean energy / a plant leaf). The clock circle is stroked in `--accent`; the leaf is a filled bezier in the same colour. The wordmark `EnergySaver` sits to the right in `Inter` 600 weight. Two sizes: `sm` (32 px height, header) and `lg` (48 px, footer/splash).

```
 ╭──╮
 │ ╲│  ← clock face with leaf-hands
 ╰──╯ EnergySaver
```

The SVG is inline (not an `<img>`) so it inherits CSS `color` and can be animated on hover. No raster fallback needed — viewBox scales from 16 px to 512 px without pixelation.

### §E1.2 — Site header (`<SiteHeader>`)

**File:** `apps/web/components/SiteHeader.tsx`

Sticky, full-width, `backdrop-blur-sm` frosted glass. Structure:

```
[Logo] [Home] [Calculator] [Appliances] [Blog]       [DayPlan badge] [ThemeToggle]
```

- Logo: `<Logo size="sm" />` as an `<a href="/">`
- Nav links: Next.js `<Link>`, underline-on-hover, active route gets accent colour via `usePathname()`
- **Day Plan badge:** shows count of appliances added to the day plan (§E3); links to `/planner`
- **ThemeToggle:** sun/moon SVG icon button, `aria-label="Switch to dark/light mode"`, calls `document.documentElement.classList.toggle('dark')` and persists to `localStorage`
- On mobile: nav links collapse into a hamburger drawer (details/summary, no extra lib)
- Announced to screen readers as `role="banner"` / `<header>`
- Height: 56px desktop, 48px mobile; `z-index: 50`

### §E1.3 — Enhanced design tokens

Extended `globals.css` and `tailwind.config.js`:

```css
:root {
  /* Existing */
  --bg: #FAFAF8;
  --bg-card: #FFFFFF;
  --accent: #2FBF71;
  --accent-hover: #27A862;
  --text: #111111;
  --text-muted: #6B7280;
  --border: #E5E7EB;
  /* New */
  --surface-muted: #F4F4F1;
  --ring: #2FBF71;
  --success: #2FBF71;
  --warning: #F59E0B;
  --danger: #EF4444;
  --glass-bg: rgba(255,255,255,0.7);
  --glass-border: rgba(255,255,255,0.3);
  /* Intensity gradient stops (used by gauge) */
  --i-very-low: #2FBF71;
  --i-low: #86EFAC;
  --i-moderate: #FCD34D;
  --i-high: #F97316;
  --i-very-high: #DC2626;
}

.dark {
  /* Existing */
  --bg: #0F1117;
  --bg-card: #1A1D27;
  --accent: #3AD57F;
  --accent-hover: #2FBF71;
  --text: #F9FAFB;
  --text-muted: #9CA3AF;
  --border: #2D3748;
  /* New */
  --surface-muted: #111827;
  --ring: #3AD57F;
  --success: #3AD57F;
  --warning: #FBBF24;
  --danger: #F87171;
  --glass-bg: rgba(26,29,39,0.8);
  --glass-border: rgba(255,255,255,0.08);
}
```

Tailwind extension adds these as named utilities: `bg-glass`, `border-glass`, `text-success`, `text-warning`, `text-danger`, `ring-ring`.

---

## §E2 — Visualisations

> **Rendering budget rule (carried from §8):** The initial bundle stays ≤180 KB. Every new chart/viz is a `next/dynamic({ ssr: false })` chunk. Each chunk has its own size-limit entry in `.size-limit.json`. Charts share a single uPlot instance across tabs where possible.

### §E2.1 — Carbon Intensity Gauge (hero widget replacement)

**File:** `apps/web/components/CarbonGauge.tsx` · Replaces `<CurrentIntensityWidget>`

A semi-circular arc gauge drawn in an inline SVG (no canvas, no lib — pure SVG math):

- **Outer arc:** a full 180° arc (left to right) stroked with a 5-stop conic gradient: `#2FBF71 → #86EFAC → #FCD34D → #F97316 → #DC2626`
- **Needle:** a thin line from the centre to the arc, rotated by `(intensity / 700) * 180°` (700 gCO₂/kWh ≈ theoretical max), animated with `transition: transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)` (spring) — gated behind `prefers-reduced-motion`
- **Centre text:** current value in `JetBrains Mono` bold, with the unit `gCO₂/kWh` below it; the intensity index label (e.g. "High") in the accent colour of that band
- **Scale ticks:** 5 labelled ticks at 0, 100, 200, 350, 500+ with the band colour
- **Accessibility:** `role="meter"`, `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=700`, `aria-label`
- **Size:** 280px wide × 160px tall; responsive via `viewBox` — fits in a 2-column card alongside the 48h ribbon

No JavaScript dependency. The gauge redraws by updating a single CSS custom property `--gauge-angle` via a `useEffect`.

### §E2.2 — 48h Grid Calendar (replaces ribbon)

**File:** `apps/web/components/ForecastGrid.tsx` · Replaces `<CarbonHeatmapRibbon>`

A rich interactive 48h calendar grid showing **12-hour AM/PM windows**:

```
         TONIGHT                    TOMORROW AM               TOMORROW PM
  12am 1am 2am … 11am   │  12pm 1pm 2pm … 11pm   │  12am 1am … 11am   │  12pm …
  [▓][▓][░][░]…[░][▒]   │  [░][░][░]…[▒][▒][▒]   │  …
```

Layout:
- Grid of 96 cells (48h × 30-min slots), grouped into 4 labelled columns of 24 cells each (12h): **Tonight**, **Tomorrow AM**, **Tomorrow PM**, **Day After AM**
- Each cell is a small coloured square (12×24px desktop, 8×16px mobile), colour = intensity index CSS class
- **Hover/tap tooltip:** floating panel showing exact time (12h AM/PM), gCO₂/kWh, price (p/kWh), intensity band, and "Select for [current appliance]" button
- **Appliance assignment:** clicking a cell range (click start + click end) highlights that window and pre-fills the calculator with that slot — deep-links to `/calculator?from=<ISO>&appliance=<id>`
- **"Now" marker:** a vertical pulse line at the current time slot
- **Day Plan overlay:** when appliances are in the Day Plan (§E3), their assigned slots are outlined in the plan colour
- Accessible: `role="grid"`, each cell is a `<button>` with `aria-label="2am Wednesday 40 gCO₂/kWh Low price: 9p"`, arrow-key navigation
- No JS lib. Pure CSS grid, `position: sticky` headers, CSS custom property colouring.

### §E2.3 — Price vs Carbon Scatter Plot (new insight tab in Calculator)

**File:** `apps/web/components/ScatterPlot.tsx` · New fifth tab: **"Best slots"**

A canvas scatter plot (no lib — ~80 lines):
- X axis: price (p/kWh), Y axis: carbon intensity (gCO₂/kWh)
- Each of the 96 half-hourly slots is a circle, radius = fixed
- Colour = intensity index
- **Recommended window slots:** highlighted with a larger radius and a ring outline in `--accent`
- **Hover:** nearest-dot detection via distance formula; shows tooltip with time + values
- **Quadrant labels:** lower-left = "Cheapest & Greenest ✓", upper-right = "Costly & Dirty ✗" — the four quadrants drawn as faint tinted rectangles
- On flat-rate tariffs: all dots share the same X value, showing a perfect vertical line — which correctly illustrates that load-shifting only helps on TOU tariffs for cost (but always helps for carbon)
- Accessible: visually-hidden data table below; `aria-label` summary; colour not the only signal (dots are also labelled by quadrant position)

### §E2.4 — CO₂ Equivalences Widget

**File:** `apps/web/components/Co2Equivalences.tsx`

Replaces the bare "218 g CO₂" stat with a human-scale comparison row:

```
Your plan saves 218 g CO₂
≈  1.5 km by car   │   0.9 km by plane   │   24h laptop use   │  plant 0.01 trees
```

Equivalences used (all sourced from authoritative published values, cited in a comment):
| Equivalence | Factor |
|---|---|
| Car km | 120 g CO₂/km (UK avg, BEIS 2024) |
| Short-haul flight km | 255 g CO₂/km (passenger, Atmosfair) |
| Laptop hour | 9 g CO₂/hour (avg 15W device at UK grid average) |
| Tree (absorbed/year) | 21,000 g CO₂/year → 57.5 g/day |
| Beef meal (500g) | ~6,000 g CO₂ |
| Streaming hour | ~36 g CO₂ |

Rendered as a horizontal scrollable row of icon+value chips. Icons are inline SVGs (no icon font). Values animate up from zero using `requestAnimationFrame` (gated behind `prefers-reduced-motion`). The chip that gives the most intuitive comparison for the saving amount is auto-selected as the headline (e.g. if saving > 1000g, use "beef meal"; if < 50g, use "laptop hours").

### §E2.5 — Animated Savings Ticker

**File:** `apps/web/components/SavingsTicker.tsx`

Replaces the static £ and kg numbers in `<SavingsResult>`:
- Numbers tick up from 0 to the target value over 800ms using a linear interpolation RAF loop
- `prefers-reduced-motion`: skips animation, shows final value immediately
- Implements the §11 requirement that was specified but not built

### §E2.6 — Multi-appliance Gantt Timeline

**File:** `apps/web/components/PlannerGantt.tsx` · Used in `/planner`

A horizontal 48h Gantt chart rendered in an SVG:
- X axis: time (48h, shown as AM/PM labels every 3h)
- Y axis: each appliance in the day plan (one row per appliance)
- Each scheduled slot = a filled rounded rectangle, coloured by intensity band of that window
- The optimal window for each appliance is shown in solid colour; alternatives are shown as ghost outlines
- **Drag to reschedule:** `onPointerDown/Move/Up` — dragging a bar updates the start time and triggers live recalculation of that appliance's cost/CO₂. All totals update in real time.
- **Conflict indicator:** if two high-power appliances overlap (combined > 10 kW, typical circuit limit), a red border and warning icon appear on both bars
- **Summary row:** at the top, a colour strip showing the aggregate carbon intensity across the 48h, with assigned appliance windows marked
- Accessible: each bar is a `<button role="row">` with `aria-label`, keyboard-moveable with ←→ (30-min increments)
- No chart lib. Pure SVG + pointer events.

---

## §E3 — Multi-appliance Day Planner

### §E3.1 — Route: `/planner`

New static page with a full client island. No SSR data needed beyond the committed appliance list. URL state:
```
/planner?appliances=tumble-dryer:0.5,dishwasher:0.5,ev-charger-7kw:0.8&postcode=SW1A&tariff=flat-standard
```

`appliances` param: comma-separated `id:weight` pairs. Weight per appliance (0=cheapest, 1=greenest) can be set individually.

### §E3.2 — Constraint-aware scheduler algorithm

**File:** `apps/web/lib/schedule-plan.ts`

Input: `{ appliances: ScheduleItem[], slots: MergedSlot[] }`

Where `ScheduleItem = { appliance: Appliance, weight: number, earliestStart?: string, latestEnd?: string }`.

Algorithm:
1. For each appliance, run `findBestWindow` with its weight to get a scored ranking of all valid windows.
2. Assign appliances in descending order of power (highest-draw first — they have fewer valid low-intensity windows).
3. For each appliance, pick the highest-scoring window that does not overlap with any already-assigned window from a higher-priority appliance.
4. Mark the assigned slots as "occupied" and continue.
5. Return the full plan: `{ assignments: Assignment[], totalCostGbp: number, totalCo2Kg: number, totalSavingGbp: number, totalSavingCo2Kg: number }`.

**Edge cases:**
- If no non-overlapping window exists, assign the best available window anyway (overlap tolerated) and flag with `overlaps: true` — the user can resolve manually.
- If `earliestStart`/`latestEnd` are set (user-constrained window), restrict the sliding window search to that range.
- A one-line self-check: plan of [dryer, dishwasher] on a fixture → no overlapping windows and combined saving > 0.

### §E3.3 — Appliance picker / "My Plan" sidebar

**File:** `apps/web/components/PlannerSidebar.tsx`

- A list of all appliances from `data/appliances.json`, each with an "Add to plan" button
- Added appliances appear in a "Today's plan" list with:
  - Per-appliance green/cost weight slider (synced to URL)
  - Optional time-window constraint (earliest start / latest end) — 12h AM/PM picker
  - Remove button
- Persisted to `localStorage` key `energysaver:plan` so the plan survives page refresh
- URL is kept in sync for sharing

### §E3.4 — Real-time recalculation

Whenever any of these change, the full plan recalculates immediately (no explicit "Run" button needed for re-runs):
- Appliance added or removed
- Any appliance's weight slider moved
- Any appliance's time window constraint changed
- Tariff changed
- Postcode changed

Implementation: `useEffect` with deps `[planItems, tariff, postcode, mergedSlots]`. The scheduler runs synchronously (96 slots × 8 appliances = 768 comparisons — trivial). Debounced 150ms on slider drag to avoid thrash.

### §E3.5 — Plan summary card

**File:** `apps/web/components/PlanSummary.tsx`

A sticky card at the bottom of the planner showing:
- Total estimated cost for today's plan (with all appliances)
- Total CO₂ for the plan
- Savings vs "all at peak" baseline
- `<Co2Equivalences>` for the total saving
- "Share plan" button: `navigator.share()` with the canonical plan URL

---

## §E4 — PWA Push Notifications

> **Constraint:** GitHub Pages is static — no push server. All notifications use the **Web Notifications API** (foreground) or **Periodic Background Sync** (background, Chromium only). No server-sent push. The app degrades gracefully on browsers that don't support the background APIs.

### §E4.1 — Service Worker enhancements

**File:** `apps/web/public/sw.js`

The existing Workbox SW is extended with:

```js
// ponytail: uses self.registration.showNotification so notifications fire from
// the SW context and appear even if the tab is in the background (but not if
// the browser is fully closed). Full push server required for that case — noted
// as a future upgrade. The static-site constraint makes a full push server a
// separate infrastructure decision, deferred per §0.5.
```

Handles two custom message types from the main thread:
- `{ type: 'SCHEDULE_NOTIFICATION', id, title, body, tag, fireAt }` — stores the scheduled notification in `IndexedDB` and uses `setTimeout` (while SW is alive) or falls back to the main thread scheduler
- `{ type: 'CANCEL_NOTIFICATION', tag }` — removes a pending notification

### §E4.2 — Notification scheduler

**File:** `apps/web/lib/notification-scheduler.ts`

```ts
interface ScheduledNotification {
  id: string;           // appliance id + start ISO
  applianceId: string;
  applianceName: string;
  startIso: string;     // when the optimal window begins
  leadMinutes: number;  // 60 or 0
}

// Persists to localStorage. On page load, rehydrates and re-arms any
// notifications whose fireAt is still in the future.
// ponytail: uses window.setTimeout as the scheduler. Accurate only while
// the page tab is open. SW-based alarm (Chromium Periodic Background Sync)
// requires server-side VAPID keys — deferred as a backend upgrade.
```

### §E4.3 — Notification permission UI

**File:** `apps/web/components/NotificationPanel.tsx`

Shown as a slide-in panel from the `<SavingsResult>` and `<PlanSummary>` cards:

```
┌─────────────────────────────────────────────────────┐
│ 🔔  Get reminded when it's time                     │
│                                                     │
│  [x] 1 hour before the window opens     [On]  [Off] │
│  [x] When the window starts             [On]  [Off] │
│                                                     │
│  Applies to:  [Tumble Dryer ▾]                      │
│                                          [Enable →] │
└─────────────────────────────────────────────────────┘
```

Flow:
1. User clicks "Enable" → `Notification.requestPermission()`
2. If granted: schedule two `setTimeout` callbacks (lead + start) and show a confirmation
3. If denied: show a small guide to re-enable in browser settings
4. Granted state persists in `localStorage`

On PWA install: offer notifications immediately via `appinstalled` event listener.

### §E4.4 — In-app notification banner

**File:** `apps/web/components/NotificationBanner.tsx`

When a scheduled notification fires (the `setTimeout` triggers while the tab is open), instead of only the OS notification, also show an in-app toaster:

```
╔══════════════════════════════════════════════════════╗
║  ⚡  Best time to start your Tumble Dryer is NOW      ║
║  Running now: ~£0.92 · 156 g CO₂ — 218g saved       ║
║                             [Start plan]  [Dismiss]  ║
╚══════════════════════════════════════════════════════╝
```

Positioned fixed at the bottom-right, slides up, auto-dismisses after 30s. `role="alertdialog"`, `aria-live="polite"`.

---

## §E5 — UX improvements

### §E5.1 — 12h AM/PM time format throughout

**File:** `apps/web/lib/format-time.ts` (new shared utility)

```ts
/** Format a UTC ISO string as "2:30 AM" in Europe/London local time. */
export function fmt12h(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Europe/London',
  });
}

/** Format as "Fri 2:30 AM" */
export function fmt12hWithDay(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Europe/London',
  });
}
```

Replace every `toLocaleString` call in `SavingsResult`, `SlotGrid`, `TimelineChart`, `ForecastGrid`, and `SavingsResultIsland`.

### §E5.2 — Share button

**File:** inline in `SavingsResult.tsx` and `PlanSummary.tsx`

```ts
async function handleShare(url: string, text: string) {
  if (navigator.share) {
    await navigator.share({ title: 'EnergySaver', text, url });
  } else {
    await navigator.clipboard.writeText(url);
    // show copied toast
  }
}
```

### §E5.3 — Loading skeleton improvements

Replace `animate-pulse bg-[var(--border)]` rectangles with content-shaped skeletons:
- `SavingsResult` skeleton: correct proportions for headline + two stat boxes + disclaimer
- `ForecastGrid` skeleton: 4 columns of 24 shimmer cells each

### §E5.4 — Empty & degraded states

Every component that shows live data must have three visual states:
1. **Loading** — skeleton
2. **Live data** — normal view
3. **Degraded** — amber banner: "Using estimated data — live prices not yet published for this window" (already partially implemented but unstyled)

### §E5.5 — Nav bar integration

Add `<SiteHeader>` to `app/layout.tsx`. Add `padding-top: 56px` to `<main>` to account for sticky header. Each page's `<main>` removes its current top-padding (since the header provides it).

---

## §E6 — Implementation order

Execute in this sequence to keep the app in a working state throughout:

### Wave 1 — Design foundation (unblocks everything)
1. **`globals.css`** — add new tokens (§E1.3)
2. **`tailwind.config.js`** — wire new tokens
3. **`Logo.tsx`** — inline SVG wordmark
4. **`SiteHeader.tsx`** — sticky header + ThemeToggle + mobile menu
5. Wire `<SiteHeader>` into `app/layout.tsx`
6. **`format-time.ts`** — 12h util; replace all time display calls

### Wave 2 — Upgraded hero & heatmap
7. **`CarbonGauge.tsx`** — SVG arc gauge; replace `<CurrentIntensityWidget>` on homepage
8. **`ForecastGrid.tsx`** — 48h AM/PM interactive grid; replace `<CarbonHeatmapRibbon>`

### Wave 3 — Calculator enhancements
9. **`SavingsTicker.tsx`** — animated number; wire into `SavingsResult`
10. **`Co2Equivalences.tsx`** — widget; wire into `SavingsResult`
11. **`ScatterPlot.tsx`** — fifth tab "Best slots" in `CalculatorShell`
12. `format-time.ts` in `SlotGrid` + `TimelineChart`

### Wave 4 — Day Planner (new route)
13. **`schedule-plan.ts`** + self-check test
14. **`PlannerSidebar.tsx`** + localStorage persistence
15. **`PlannerGantt.tsx`** — SVG Gantt
16. **`PlanSummary.tsx`**
17. `app/planner/page.tsx`
18. Update sitemap + nav link

### Wave 5 — PWA notifications
19. **`notification-scheduler.ts`**
20. **`NotificationPanel.tsx`**
21. **`NotificationBanner.tsx`**
22. Wire SW message handling into `public/sw.js` (or Workbox plugin)

### Wave 6 — Polish & QA
23. Share buttons (`SavingsResult`, `PlanSummary`)
24. Skeleton improvements (§E5.3)
25. Degraded state styling (§E5.4)
26. Keyboard navigation sweep (§14 compliance)
27. Lighthouse run + fix any regressions

---

## §E7 — New schemas

### `ScheduleItem` (in `packages/schema/src/planner.ts`)
```ts
export const ScheduleItemSchema = z.object({
  applianceId: z.string(),
  weight: z.number().min(0).max(1).default(0.5),
  earliestStartHhMm: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  latestEndHhMm: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const DayPlanSchema = z.object({
  items: z.array(ScheduleItemSchema),
  postcode: z.string().default(''),
  tariffId: z.string().default('flat-standard'),
});

export const AssignmentSchema = z.object({
  applianceId: z.string(),
  start: z.string(),  // ISO UTC
  end: z.string(),
  costGbp: z.number(),
  co2Kg: z.number(),
  overlaps: z.boolean().default(false),
});

export const DayPlanResultSchema = z.object({
  assignments: z.array(AssignmentSchema),
  totalCostGbp: z.number(),
  totalCo2Kg: z.number(),
  totalSavingGbp: z.number(),
  totalSavingCo2Kg: z.number(),
});
```

### `ScheduledNotification` (in `packages/schema/src/notification.ts`)
```ts
export const ScheduledNotificationSchema = z.object({
  id: z.string(),
  applianceId: z.string(),
  applianceName: z.string(),
  startIso: z.string(),
  leadMinutes: z.number().int().nonneg(),
  createdAt: z.string(),
});
```

---

## §E8 — New routes

| Route | Type | Description |
|---|---|---|
| `/planner` | Static shell + client island | Multi-appliance Day Planner |

`app/planner/page.tsx` — static shell with SEO metadata and a `<PlannerIsland>` client component. URL state carries the full plan. `generateMetadata` produces a description like "Plan your appliances for the cheapest, greenest day" with dynamic OG.

---

## §E9 — Bundle impact

| New chunk | Estimated size | Load trigger |
|---|---|---|
| `CarbonGauge` | ~3 KB (inline SVG, no lib) | Homepage load (not lazy — it's the hero) |
| `ForecastGrid` | ~6 KB | Homepage load (replaces ribbon — also not lazy) |
| `ScatterPlot` | ~4 KB (canvas, no lib) | Fifth calculator tab |
| `PlannerGantt` | ~12 KB (SVG + pointer events) | `/planner` page load |
| `notification-scheduler` | ~3 KB | Inline in SavingsResult/PlanSummary |

None of these exceed the per-chunk budgets. The existing uPlot timeline (~45 KB) and SlotGrid (~8 KB) lazy chunks are unchanged. Total new JS in the initial bundle: `CarbonGauge` + `ForecastGrid` + `SavingsTicker` + `Co2Equivalences` ≈ 20 KB — within headroom.

---

## §E10 — Open questions (resolved before Wave 4+)

| Question | Resolution |
|---|---|
| Background notifications without a push server | Ship Wave 5 as foreground-only (setTimeout while tab open) + OS notification when tab is visible. Add a `ponytail:` comment noting the VAPID/push-server upgrade path. |
| Drag-to-reschedule on touch | Use `pointer events` (not mouse-only) — works on touch natively. Test on iOS Safari and Android Chrome. |
| Plan URL length limits | A 8-appliance plan URL is ~120 chars — safe for all browsers. No compression needed at this scale. |
| Periodic Background Sync API | Chromium-only, requires `periodicsync` permission. Wire as a progressive enhancement — register if available, no-op otherwise. Document the limitation prominently in the NotificationPanel. |

---

## §E11 — Definition of done (enhancement)

- [ ] **Wave 1:** Site header with logo, theme toggle, mobile menu present on every page; all times display in 12h AM/PM format
- [ ] **Wave 2:** `CarbonGauge` animates to live value; `ForecastGrid` renders all 96 slots with AM/PM grouping, hover tooltips, and "now" marker
- [ ] **Wave 3:** `SavingsResult` shows animated ticker and CO₂ equivalences; scatter plot tab renders with correct quadrant labels
- [ ] **Wave 4:** `/planner` page loads; adding 2+ appliances produces a non-overlapping schedule; Gantt renders all assignments; plan URL is shareable; real-time recalculation on slider drag
- [ ] **Wave 5:** Notification permission flow works in Chrome; a scheduled notification fires at the correct time (manually verified); in-app banner shows alongside OS notification
- [ ] **Wave 6:** Lighthouse performance ≥ 0.90, a11y ≥ 0.95; all new components keyboard-navigable; no horizontal overflow at 320px
