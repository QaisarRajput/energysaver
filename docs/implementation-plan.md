# Implementation Plan — Grid-Smart Energy Timer (`energysaver.hubs.dpdns.org`)

> Conforms to `docs/instructions.md` (GitHub Pages Application Standard v2). Every section number in parentheses (e.g. §3) refers to that standard. This file is the plan; the standard is the constraint set it obeys.
>
> **One-line product promise:** turn an abstract "187 gCO₂/kWh" into *"Run your dryer at 02:00 instead of 18:00 tonight and save £1.40 and 0.8 kg CO₂."*

---

## §0 — Source / data validation (verified before design)

Three data sources power the app. Two are live external APIs (client-fetched at runtime, §6 "External API" + "Client-fetched" hybrid); the rest is small committed static data (§6 "Committed JSON").

### §0.1 — Carbon Intensity API (live, primary) — **VALIDATED**
- **Base URL:** `https://api.carbonintensity.org.uk` — official National Energy System Operator (NESO) API for **Great Britain** (England, Scotland, Wales; **not** Northern Ireland).
- **Auth:** none. **CORS:** `Access-Control-Allow-Origin` present on every documented endpoint → safe to call directly from the browser.
- **Granularity:** 30-minute settlement periods, all timestamps UTC (`YYYY-MM-DDThh:mmZ`).
- **Endpoints used:**
  - National 48h forward forecast: `GET /intensity/{from}/fw48h` → `data[].intensity.forecast` (gCO₂/kWh) + `.index` (`very low`…`very high`).
  - Regional 48h forward forecast by outward postcode: `GET /regional/intensity/{from}/fw48h/postcode/{postcode}` (postcode = *outward* only, e.g. `RG41`).
  - Current national snapshot for the hero widget: `GET /intensity`.
- **License:** CC BY 4.0 — requires visible attribution (§21). Terms: `github.com/carbon-intensity/terms`.
- **Constraint:** forecast horizon is ~48h; NI is unsupported → surface a clear "GB only" note.

### §0.2 — Octopus Agile unit rates (live, for Agile users) — **VALIDATED**
- **Base URL:** `https://api.octopus.energy`.
- **Endpoint:** `GET /v1/products/{product_code}/electricity-tariffs/{tariff_code}/standard-unit-rates/?period_from={ISO}&period_to={ISO}` → half-hourly `results[].value_inc_vat` (pence/kWh) with `valid_from`/`valid_to`. Access level is `None` (unauthenticated allowed).
- **Product/tariff codes:** national product code (e.g. `AGILE-24-10-01`) + region-specific tariff code `E-1R-{product}-{GSP letter}` where the GSP letter is one of 14 groups (`A`–`P`).
- **Agile release window:** next-day prices publish ~16:00 UK time. Beyond the published horizon, the app falls back to the user's static TOU preset (§0.4) and labels prices as "estimated".
- **Runtime CORS caveat:** treated as an **explicit Phase-1 verification task** (curl + browser `fetch` from the deployed origin). If a CORS block appears, the fallback is the committed Agile-region rate snapshot synced by `etl.yml` (§8) — the app degrades to "yesterday's Agile shape" rather than breaking. `ponytail:` do not build a proxy; a nightly committed snapshot is the smaller, zero-backend mitigation.

### §0.3 — Postcode → GSP region map (static, committed)
- The authenticated `/v1/industry/grid-supply-points/` endpoint is **deliberately not used** (needs a key). Instead, `data/regions.json` holds a committed map of **postcode area → { gspLetter (A–P), carbonRegionId (1–17) }**, letting one postcode drive both the Agile tariff code and the carbon regional endpoint. Stable, public, rarely-changing reference data.

### §0.4 — Appliance wattage table + TOU tariff presets (static, committed, hand-authored)
- `data/appliances.json` — curated appliances with typical power (kW) and default run duration (e.g. tumble dryer 2.5 kW / 1.5h; dishwasher 1.2 kW / 2h; washing machine 0.8 kW / 1.5h; EV charge 7.4 kW / user-set kWh). Each has a stable slug ID.
- `data/tariffs.json` — published TOU presets for non-Agile users (Economy 7, Economy 10, flat standard, Go-style EV) as `{ peakRate, offPeakRate, windows[] }`. `data/overrides.json` handles curation/blocklist (§6).
- **Values are illustrative estimates, not billing-accurate** — surfaced with a disclaimer (§21 /terms). `ponytail:` a small hand-authored JSON table is the right ceiling here; no scraping pipeline is warranted.

### §0.5 — Resolved project-level decisions (§24.1)
| Decision | Resolution |
|---|---|
| Subdomain (§10) | `energysaver.hubs.dpdns.org` (user-specified). `basePath: ''`, `CNAME` = same. |
| `config/site.ts` plan (§9) | Real: `site.*`, `analytics.provider='cloudflare'`. Placeholders (empty → graceful hidden state): `monetization.tipUrl`, affiliate tag, `adsense.*` (`ready:false`), social handles, `giscus.*`. |
| Tone (§17) | **Professional-but-warm** — audience is climate-conscious households + EV owners; benefit-led and trustworthy, lightly human, minimal emoji. Stated explicitly per §17. |
| Monetization (§20) | **Two patterns:** (1) Tip/support button → `config.monetization.tipUrl`; (2) Affiliate smart-plug links (`rel="sponsored noopener"` + visible disclosure). AdSense deferred (`ready:false`) until §21 checklist passes. |
| Analytics (§16) | **Cloudflare Web Analytics** (cookieless → no consent banner). |
| Image viewer (§12) | **Not applicable** — data/tool site, no photo galleries. Lightbox skipped. |
| Blog topics (§18) | 4 posts (see §18 below). |
| FAQ topics (§19) | 6–8 Q&A (see §19 below). Dedicated `/faq` is overkill for a single-tool site → homepage FAQ section. |

---

## §0.6 — How the "cheapest + greenest window" recommendation is computed (core mechanism)

This is the product's whole reason to exist, so the algorithm is specified before any task list.

**Inputs**
- Appliance: `powerKw` and run length `D` (in 30-min slots; `D = ceil(hours / 0.5)`). For EV charging, `D` is derived from a target kWh ÷ power.
- A merged half-hourly series for the next ≤48h, one row per settlement slot `t`:
  - `intensity_t` (gCO₂/kWh) from §0.1, keyed by UTC `from`.
  - `price_t` (p/kWh) from §0.2 (Agile) **or** derived from the selected TOU preset §0.4 by checking which window `t` falls into.
- A user weight `w ∈ [0,1]`: `0` = pure cheapest, `1` = pure greenest (default `0.5`, "balanced").

**Per-slot energy:** `energyKwh_t = powerKw × 0.5`.

**Sliding window (contiguous run):** for every valid start `s` where `s + D ≤ horizon`:
- `cost(s)  = Σ_{t=s}^{s+D-1} energyKwh_t × price_t`  (£ = pence/100)
- `co2(s)   = Σ_{t=s}^{s+D-1} energyKwh_t × intensity_t / 1000`  (kg)

**Selection:** normalise `cost` and `co2` across all `s` to `[0,1]`; `score(s) = w·co2̂(s) + (1−w)·cost̂(s)`; recommend `argmin score`. Also expose the pure-cheapest and pure-greenest windows so the tradeoff is visible.

**Baseline for the headline saving:** a fixed evening-peak window (default 17:00–20:00 local, configurable), plus a "vs now" comparison. Headline = `baseline − recommended` for both £ and kg, floored at 0 with a "already optimal" state.

**Edge cases (validated at the boundary, §7):**
- Price horizon shorter than carbon horizon (Agile not yet published) → truncate to the overlap; if a slot has no live price, fall back to the TOU preset and flag the result "estimated".
- Run length longer than remaining horizon → clamp and warn.
- DST / UTC↔local: all maths in UTC; only the *display* converts to `Europe/London` via `Intl.DateTimeFormat` (no manual offset arithmetic).
- Empty/short API payloads → skip-and-degrade, never NaN. One runnable self-check (§0 ponytail) asserts a known fixture yields the known optimal slot.

---

## Guiding principles (§24.3)

1. **All code follows the §0 ponytail discipline:** reuse before writing, standard library before dependency, smallest correct diff, root-cause fixes, `ponytail:` comments on intentional shortcuts.
2. **Static-first, no backend.** Next.js `output: 'export'` (§2). All live data is fetched client-side; every route is pre-rendered at build time (§3).
3. **One source of truth for config.** Every link, tariff-source URL, tip URL, affiliate tag, and domain lives only in `config/site.ts` (§9).
4. **Trust boundary is explicit.** All three data sources are untrusted → Zod-validated at ingestion, `try/catch` per record, `https:` href validation, no `dangerouslySetInnerHTML` of external strings (§7).
5. **The number is the product.** Every screen drives toward a concrete £ + kg CO₂ figure with a named start time — never a bare intensity value.
6. **Monetization chosen:** tip button + affiliate smart-plug links (§20) — they fit a household-advice site without cluttering the tool; AdSense is wired but dormant until approved.
7. **Accessibility and Lighthouse are gates, not polish** (§8, §14) — and they double as AdSense-readiness signals (§21).
8. **Rich visuals must not cost initial-load performance.** Heavy visualization libraries (grid, charts) are never in the critical bundle — they are `next/dynamic({ ssr:false })` chunks loaded only when their tab is opened, so the 180 KB budget (§8) covers the app shell, not the viz. Charts prefer a tiny canvas renderer over a large React chart lib; the grid loads on demand. Performance and "amazing visuals" are reconciled by code-splitting per tab, not by dropping either.

---

## Design system spec (§4, §11)

- **Tokens first** (§11): warm off-white canvas `--bg:#FAFAF8`, single vibrant accent (energy-green) `--accent:#2FBF71` light / `#3AD57F` dark, full light+dark token sets wired into Tailwind `theme.extend`. Accent chosen for the "clean energy" association; contrast verified ≥4.5:1 both themes (§14).
- **Theme:** `class="dark"` on `<html>`, pre-paint inline script reads `localStorage` → falls back to `prefers-color-scheme` (no FOUC). Manual toggle persists.
- **Typography:** `Inter` variable (UI) + `JetBrains Mono` (numbers/prices/times) via `next/font` (self-hosted). Fluid `clamp()` scale.
- **Motion:** all transitions gated behind `prefers-reduced-motion: no-preference` (§11). The "savings counter" tick-up animation specifically respects this.
- **Spacing/radii/elevation:** 4px scale; cards 16px, pills 9999px, buttons 12px; soft low-spread shadows, elevate on hover/focus only.
- **Brand assets generated at build time** (§10, via `satori`/`@napi-rs/canvas`): SVG wordmark (clock + leaf motif, accent + text tokens, crisp 32px→512px); 1200×630 OG/social banner; homepage hero banner; PWA icons 192/512 + maskable + 180 Apple touch (§23).

**Signature component — `<SavingsResult>`:** the payoff card. Shows recommended start time (large, mono), £ saved + kg CO₂ saved vs baseline, a 48h sparkline of price & intensity with the chosen window highlighted, and a "why" line. Reused on the calculator and each appliance page.

### Data visualization & tabbed insights system

The interactive result on `/calculator` (and a compact variant on each appliance page) is a **tabbed insight panel** — an accessible tablist (roving tabindex, arrow-key nav, `aria-selected`, `Esc`-safe, WCAG per §14) whose panels are lazy-loaded. State (active tab, inputs) lives in the URL query so any view is shareable (§12). Tabs:

| Tab | What it shows | Rendering tool | Why this tool |
|---|---|---|---|
| **Recommendation** | `<SavingsResult>` payoff card (default tab, always in the initial bundle) | Hand-coded SVG/CSS sparkline | Tiny, no dependency, instant paint — the one view that must never wait on a chunk. |
| **Timeline** | 48h dual-axis chart: price (p/kWh) + carbon intensity (gCO₂/kWh), the recommended window shaded, "now" marker, hover tooltip | **uPlot** (~45 KB, canvas) | Purpose-built for dense time-series (96 half-hourly points × 2 series); far lighter and faster than Recharts/Chart.js; canvas keeps 60fps on mobile. Lazy-loaded. |
| **All slots** | Sortable, filterable, column-pinned grid of every half-hourly slot: time, price, intensity, £/kg for this appliance, "in recommended window?" flag | **AG Grid Community** (dynamic import) | The rich sort/filter/pin/CSV-export grid requested; MIT Community edition, loaded only when this tab opens so it never touches first paint. Row virtualization handles the ≤96 rows trivially and scales if the horizon grows. |
| **Compare tariffs** | Small-multiples bar/heatmap comparing best-window cost across the TOU presets + Agile for the chosen appliance | uPlot bars + a CSS token heatmap | Answers "would switching tariff beat load-shifting?" — reuses the already-loaded chart chunk, no new dependency. |

**Cross-cutting viz rules:**
- **Carbon heatmap ribbon** — a reusable 48×1 CSS-grid strip coloring each half-hour by the API's `index` band (`very low`…`very high`) using accent-derived tokens; pure CSS, no JS lib, used on the hero and above every tab.
- **Theming:** charts and grid read the CSS custom-property tokens (§11) so light/dark and the accent stay consistent; no hardcoded chart palette.
- **Motion:** chart draw-in and counter animations gated behind `prefers-reduced-motion` (§11); grids never animate rows.
- **Accessibility:** every chart has a visually-hidden data-table equivalent and an `aria-label` summary; the grid is keyboard-navigable; color is never the only signal (icons/labels on the heatmap bands).
- **Empty/estimated states:** when live price is missing (Agile not yet published, §0.2), affected slots render in an "estimated" visual style across all tabs, not hidden.

---

## Phase 1 — Foundation, config, data contracts

- [ ] Scaffold pnpm monorepo: `apps/web` (Next.js `output:'export'`), `packages/schema`, `etl/`, `data/`, `content/blog/`, `config/site.ts`, `.github/workflows/` (§1).
- [ ] `pnpm-workspace.yaml`; enforce `etl/` never imported by `apps/web` (only `packages/schema` crosses the boundary).
- [ ] `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `moduleResolution:'bundler'`, `target:'ES2022'` (§4); extend from all packages.
- [ ] `next.config.js`: `output:'export'`, `images.unoptimized:true`, `basePath:''` (§2).
- [ ] `apps/web/public/.nojekyll` and `CNAME` = `energysaver.hubs.dpdns.org` (§2).
- [ ] `config/site.ts` + `siteConfigSchema` (§9); real values for `site.*`, `analytics.provider:'cloudflare'`; placeholders default to `''`; `adsenseIds` derived helper. `prebuild` validates it and fails on missing required fields.
- [ ] `packages/schema`: Zod schemas + `z.infer` types for `Appliance`, `TariffPreset`, `Region`, `CarbonForecastSlot`, `AgileRate`, `MergedSlot`, `Recommendation`, `BlogFrontmatter`, `SiteConfig`. `contentHash` on records that participate in diffing (§5, §6).
- [ ] Author committed static data: `data/appliances.json`, `data/tariffs.json`, `data/regions.json`, `data/overrides.json` — each validated by `pnpm --filter etl run validate` (§5, §6). Stable slug IDs, idempotent.
- [ ] **Verify live APIs from the browser origin:** curl + a throwaway `fetch` test for Carbon Intensity `fw48h` and Octopus `standard-unit-rates` CORS. Record result; wire the §0.2 fallback if Octopus blocks CORS.
- [ ] Prettier + ESLint (`@typescript-eslint/recommended`, warnings = errors) at repo root; Vitest configured (§22).

---

## Phase 2 — Core engine + live data layer

- [ ] `packages/schema`-typed fetch clients (in `apps/web/lib/`): `getCarbonForecast(postcode?)`, `getAgileRates(gspLetter, from, to)`; Zod-validate responses, `try/catch` + skip-and-degrade (§7), 10-min client cache via TanStack Query.
- [ ] `mergeSlots()` — join carbon + price series on UTC `from`; fill missing price from TOU preset and flag `estimated`.
- [ ] `findBestWindow(merged, powerKw, D, w, baselineWindow)` implementing §0.6; returns cheapest / greenest / balanced + baseline deltas.
- [ ] One runnable self-check (`findBestWindow.test.ts`) asserting a saved fixture → known optimal slot & known £/kg (§0 ponytail, §22).
- [ ] Postcode input → `data/regions.json` lookup → GSP letter + carbon region id; graceful "unknown postcode / national fallback" path.
- [ ] `Intl` `Europe/London` display formatting; all computation stays UTC.

---

## Phase 3 — Pages, rendering & routes

- [ ] **Home** (`/`) — static hero (hook + subhead + primary CTA, §17), live current-intensity widget (hydrated client island, §3), featured appliances, entry into the calculator. `generateMetadata` + dynamic OG (§15).
- [ ] **Calculator** (`/calculator`) — thin static shell hydrating into the interactive tool: postcode + tariff (Agile vs TOU preset) + appliance picker + run length + green/cost weight → `<SavingsResult>`. Filter/appliance/active-tab state driven by URL query (`?appliance=&tariff=&postcode=&tab=`) so every view is shareable (§12).
- [ ] **Tabbed insight panel** — accessible tablist (Recommendation / Timeline / All slots / Compare tariffs) per the visualization system above; each non-default panel is a `next/dynamic({ ssr:false })` chunk with a token-styled skeleton fallback. Recommendation tab ships in the initial bundle.
- [ ] **`<TimelineChart>`** (uPlot) — 48h dual-axis price + intensity, shaded recommended window, "now" marker, hover tooltip, reads theme tokens; visually-hidden table equivalent for a11y. Lazy-loaded.
- [ ] **`<SlotGrid>`** (AG Grid Community, dynamic import) — half-hourly slots with sort/filter/column-pin/CSV export and a "recommended window" row highlight; virtualized; keyboard-navigable. Loaded only when the tab opens.
- [ ] **`<TariffCompare>`** + **`<CarbonHeatmapRibbon>`** — small-multiples tariff comparison (reuses the uPlot chunk) and the pure-CSS 48-slot intensity ribbon reused on hero + tabs.
- [ ] **Appliance detail** (`/appliances/[slug]`) — `generateStaticParams` over `data/appliances.json`; static content (what it is, typical wattage, best-time guidance) + a pre-bound `<SavingsResult>` island and a compact Timeline tab. `Article`/`CreativeWork` JSON-LD (§15).
- [ ] **Category/tag pages** (`/appliances/category/[cat]`) — auto-generated per category in the data, `ItemList` JSON-LD, own metadata + sitemap entries (§15).
- [ ] **Tariffs explainer** (`/tariffs`) — static, from `data/tariffs.json`; explains Agile vs Economy 7/10 vs flat.
- [ ] **404** — styled `app/not-found.tsx` using design tokens (§8).
- [ ] `app/sitemap.ts`, `robots.txt` (`Allow: /` + sitemap URL), canonical URLs from `config.site.url` (§15).
- [ ] Share button on calculator result + appliance + blog pages: `navigator.share()` with desktop fallback menu, sharing canonical URL (§12).

---

## Phase 4 — Content: blog, FAQ, legal (§18, §19, §21)

- [ ] **Blog** (`content/blog/*.md`, remark + Zod frontmatter, `generateStaticParams`, `BlogPosting` JSON-LD, share button). Launch posts (§18), all scoped to the one niche (UK home energy timing):
  1. "What is carbon intensity — and why 2am electricity is cleaner than 6pm"
  2. "How much can shifting your dryer, dishwasher & washing machine actually save?"
  3. "Octopus Agile vs Economy 7: which suits a load-shifter?"
  4. "EV owners: the cheapest, greenest hours to charge in the UK"
- [ ] **FAQ** — homepage section, `<details>/<summary>`, `FAQPage` JSON-LD matching visible Q&A (§14, §19). Topics: is it accurate?, GB-only/why not NI?, do I need a smart meter?, Agile vs standard tariff, where the data comes from, is my postcode stored? (no — client-only), how savings are estimated, are affiliate links paid.
- [ ] **Legal pages** from `config` (§21): `/about`, `/privacy`, `/terms` (incl. "estimates, not billing advice" disclaimer), `/cookies` (cookieless Cloudflare note). Footer: flat nav (Home · Calculator · Appliances · Blog · About · Privacy · Cookies · Contact) + CC BY 4.0 attribution to the Carbon Intensity API + Octopus data + affiliate disclosure line.

---

## Phase 5 — Monetization (§20)

- [ ] `<TipButton>` → `config.monetization.tipUrl`; disabled/"coming soon" state when empty.
- [ ] `<AffiliateCard>` for recommended smart plugs on appliance pages — links built from `config` affiliate tag, `rel="sponsored noopener"`, always paired with a visible disclosure line. Empty tag → hidden, never a dead link.
- [ ] `<AdSlot>` scaffold rendered only when `config.adsense.publisherId` set **and** `config.adsense.ready===true` (stays dormant this phase). `ads.txt` + `google-adsense-account` meta derived from `adsenseIds`, emitted only once `publisherId` is set (§9, §21).

---

## Phase 6 — SEO, analytics, PWA, security (§15, §16, §21, §23)

- [ ] Dynamic per-page OG images (home/appliance/category/blog) via `satori`/`@napi-rs/canvas`, composited from brand assets + page title (§15); fallback `config.seo.defaultOgImage`.
- [ ] Cloudflare Web Analytics loaded from `config.analytics.cloudflareToken` (no inline ID, no banner) (§16).
- [ ] Google Search Console: `google-site-verification` meta from config in root layout; verify property matches `config.site.url` exactly; rely on sitemap auto-discovery; optional CI `sitemaps.submit` step (§16). Avoid the deprecated ping endpoint and the Indexing API (§16).
- [ ] PWA (§23): `app/manifest.ts` (`standalone`, `portrait`, theme/background colors from `config`), 192/512 + maskable + 180 icons, `metadata.manifest`, minimal Workbox service worker precaching the app shell + recently-viewed appliance pages.
- [ ] CSP `<meta http-equiv>` in root layout, allow-list built from config (Carbon Intensity API, Octopus API, Cloudflare analytics, tip/affiliate domains) (§21).

---

## Phase 7 — CI/CD & quality gates (§8)

- [ ] `deploy.yml`: triggers on `push` to `main` (paths `data/**`,`content/**`,`apps/web/**`,`packages/**`,`config/**`) + `workflow_dispatch`; perms `contents:read`,`pages:write`,`id-token:write`; concurrency `pages` cancel-in-progress. Steps: install → validate `config/site.ts` → validate `data/**` → restore `.next/cache` → build → **size-limit** → **Lighthouse CI** → `touch out/.nojekyll` → `upload-pages-artifact` → `deploy-pages`.
- [ ] `etl.yml` (scheduled + dispatch, `contents:write`): re-validate committed static data and refresh the **Agile fallback snapshot** (§0.2); `git-auto-commit-action` as `energysaver-bot` with `chore(data):` prefix; drift issue via `github-script` if invalid records exceed threshold (§8).
- [ ] `.next/cache` action cache; `.size-limit.json` (baseline measured, not guessed) with a **separate entry per lazy chunk** so the app-shell budget (≤180 KB) excludes uPlot and AG Grid, and each on-demand chunk (`timeline`, `slot-grid`) has its own ceiling that fails CI on regression; `lighthouserc.json` thresholds (perf .9 / a11y .95 / seo .95 / best-practices .9) — treated as hard gates.
- [ ] `renovate.json` grouping weekly minor/patch, flagging majors (§8).

---

## Phase 8 — Responsive & accessibility QA (§13, §14)

- [ ] Verify 320px→ultrawide, no horizontal overflow; app bar shrinks in landscape-phone (short viewport) via `@media (orientation: landscape)`.
- [ ] Calculator + `<SavingsResult>` sparkline, and all four insight tabs (Timeline chart, AG Grid, Compare, heatmap ribbon), tested in portrait and landscape phone specifically.
- [ ] Full keyboard path (`/` focuses postcode/appliance search, `Esc` closes any drawer), visible focus rings, semantic landmarks, one `<h1>`/page, 44×44px touch targets, alt text, contrast in both themes.

---

## Definition of done (§24.6)

- [ ] **Phase 1:** `pnpm build` produces a static `out/`; `config/site.ts` + all `data/**` pass Zod validation in CI; live-API CORS verified from the deployed origin (or fallback wired).
- [ ] **Phase 2:** `findBestWindow` self-check green; merged series produces a correct £/kg for the fixture.
- [ ] **Phase 3:** every route pre-rendered (appliance/category pages enumerated by `generateStaticParams`); calculator state (incl. active tab) is shareable via URL; the four insight tabs render, lazy-load on open, and stay within their per-chunk size budgets; sitemap + robots live.
- [ ] **Phase 4:** 4 blog posts + FAQ + all legal pages live and linked from the flat footer with CC BY 4.0 attribution.
- [ ] **Phase 5:** tip button + affiliate cards render real links or graceful disabled states; AdSense dormant (`ready:false`).
- [ ] **Phase 6:** dynamic OG per page type; Cloudflare analytics live; GSC verified; PWA installs to Android home screen with branded splash; CSP present.
- [ ] **Phase 7:** `deploy.yml` green including Lighthouse + size-limit gates; deployed at `https://energysaver.hubs.dpdns.org`; `etl.yml` runs and no-ops cleanly when data is unchanged.
- [ ] **Phase 8:** manual portrait+landscape pass at 320px and landscape-phone; a11y checks pass.

---

## Open questions (§24.7)

- [x] Subdomain — `energysaver.hubs.dpdns.org` (given).
- [x] Market scope — **UK/GB only** (free-data constraint; NI unsupported).
- [x] Tariff strategy — **live Octopus Agile + static TOU presets**.
- [x] Recommendation engine — **cheapest+greenest sliding-window finder** (§0.6).
- [x] Monetization — **tip button + affiliate smart-plug links**; AdSense deferred.
- [x] Analytics — **Cloudflare Web Analytics**.
- [ ] Real IDs to swap into `config/site.ts` later: Cloudflare Analytics token, Buy Me a Coffee/Ko-fi URL, Amazon Associates tag, (optional) GSC verification string, giscus IDs. All are config-only, zero code change.
- [ ] AdSense launch timeline — apply only after the §21 pre-flight checklist passes on the live deploy.
- [ ] Whether to add regional (postcode-level) carbon accuracy in v1 or ship national-first — recommend national-first, postcode as a fast follow (data layer already supports both).

---

## Immediate next steps (§24.8)

1. Scaffold the pnpm monorepo and workspace wiring (Phase 1, first four checkboxes).
2. Write `config/site.ts` + `siteConfigSchema` with real site values and placeholders; wire the `prebuild` validation.
3. Define the `packages/schema` Zod contracts (appliance, tariff, region, forecast slot, Agile rate, recommendation).
4. Author `data/appliances.json`, `data/tariffs.json`, `data/regions.json` (+ `overrides.json`) and the `validate` script.
5. Run the live-API CORS verification (Carbon Intensity `fw48h` + Octopus `standard-unit-rates`) from a browser context; record the result and wire the Octopus fallback if needed.
6. Implement `mergeSlots` + `findBestWindow` with its one fixture self-check.
7. Stand up the Home + Calculator shell with the current-intensity widget to prove the end-to-end data path before building out remaining routes.
