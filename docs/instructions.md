# AI Agent Instructions — GitHub Pages Application Standard (v2)

> **Audience:** AI coding agents receiving a build or implementation-plan task.
> **Scope:** Any content-heavy, data-driven, serverless application deployed to GitHub Pages.
> **Usage:** Read this file first. Every decision below is a constraint, not a suggestion. Deviate only when the user explicitly overrides a rule in the current session.
> **Output of this file:** an `implementation-plan.md` (format in §24) that a coding agent then executes. This file is the standard the plan must conform to — it is not itself the plan.

---

## 0. Engineering philosophy — lazy senior dev mode (the "ponytail" standard)

> Applies to every line of code written under this document, on top of — never instead of — the explicit architectural mandates in §1 onward. Those mandates already count as "explicitly requested," so they are not up for renegotiation by laziness. This section governs the decisions an agent makes in the gaps between them: which helper to reach for, whether a new abstraction is warranted, how big a diff should be.

**Decision ladder — read the task and trace the real flow it touches end to end first, then climb, stopping at the first rung that holds:**
1. Does this need to be built at all? (YAGNI)
2. Does it already exist in this codebase? Reuse the helper, util, or pattern that's already there — don't rewrite it.
3. Does the standard library already do this?
4. Does a native platform feature cover it?
5. Does an already-installed dependency solve it?
6. Can this be one line?
7. Only then: write the minimum code that works.

**Bug fixes target the root cause, not the symptom.** A bug report names one symptom at one call site. Grep every caller of the function being touched and fix the shared function once — a single guard there is a smaller diff than the same guard duplicated per caller, and patching only the path the ticket names leaves a sibling caller still broken.

**Rules:**
- No abstraction that wasn't explicitly requested (a rule stated elsewhere in this document counts as a request).
- No new dependency if the standard library or an existing dependency already covers it.
- No boilerplate nobody asked for.
- Deletion over addition, boring over clever, fewest files possible.
- Shortest working diff wins — but only once the problem is actually understood. A small change in the wrong place is a second bug, not a win.
- When a request implies more than it strictly needs, ask "does this need X, or does Y already cover it?" before building X.
- When two standard-library approaches are the same size, pick the one that's correct on edge cases — lazy means less code, not a flimsier algorithm.
- Mark an intentional simplification with a `ponytail:` comment naming its ceiling and the upgrade path (e.g. `// ponytail: in-memory cache, fine for one build process; move to a shared store if this ever runs concurrently`).

**Never lazy about:** understanding the problem before picking a rung; input validation at trust boundaries (§7); error handling that prevents data loss; security (§21); accessibility (§14); calibrating against real platform behavior rather than the spec ideal; and anything explicitly requested anywhere in this document. Non-trivial logic leaves behind exactly one runnable check — the smallest thing that fails if the logic breaks (an assert-based self-check, or one small test file, no framework or fixtures required). Trivial one-liners need no test.

*(Adapted from the open-source "ponytail" coding standard.)*

---

## 1. Project structure — always a pnpm monorepo

```
<project-root>/
├── apps/
│   └── web/                  # Next.js app (output: export)
├── packages/
│   └── schema/               # Zod schemas + TS types, shared by etl + web
├── etl/                      # Data pipeline (Node-only; web must never import from here)
├── data/                     # COMMITTED to git — generated but version-controlled
├── content/
│   └── blog/                 # Markdown blog posts (frontmatter), see §18
├── config/
│   └── site.ts                # SINGLE SOURCE OF TRUTH for every link, key, CTA, domain — see §9
├── .github/workflows/
│   ├── etl.yml                # data sync (scheduled)
│   └── deploy.yml             # build + deploy (triggered by data/** push)
├── pnpm-workspace.yaml
└── package.json
```

**Rules:**
- Use **pnpm workspaces**. Never npm or yarn.
- `packages/schema` is the only cross-boundary import allowed between `etl/` and `apps/web/`.
- `etl/` packages must never appear in `apps/web/` dependencies. Enforce via workspace isolation.
- `data/` is committed to git. Never `.gitignore` it. It is the local dev fixture and the diff-auditable source of truth.
- `config/site.ts` is the only file — human or agent — that should ever be edited to change a deployed link, key, domain, price, or CTA label. No other file may hardcode an external URL, tracking ID, price, or contact address. See §9.

---

## 2. Framework — Next.js static export, not a plain SPA

**Rule:** Use **Next.js with `output: 'export'`** for any content gallery, prompt library, documentation site, or data-browsing application targeting GitHub Pages.

Never use Create React App, Vite SPA, or similar client-only scaffolds for these use cases.

**Why this matters (tell the agent, once, so it does not re-argue):**
- Static export produces real HTML per route — crawlers, link-preview bots, and users without JS all get content.
- Routing works without the `404.html` SPA-fallback hack.
- `generateStaticParams` + `generateMetadata` give per-page SEO for free at build time.
- Build output is still 100% static files — identical deployment model to a SPA.

**`next.config.js` baseline (always start here):**
```js
/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export',
  images: { unoptimized: true },   // no image server in static export
  basePath: '',                     // '' for custom domain; '/repo-name' for <org>.github.io/<repo>
};
```

Set `basePath` based on the confirmed production URL:
- Custom domain or subdomain (e.g. `tax.hubs.dpdns.org`) → `basePath: ''`
- Project Pages without custom domain (e.g. `org.github.io/repo`) → `basePath: '/repo'`

The production URL used here, in `generateMetadata`, in the sitemap, and in the manifest must all read from `config.site.url` (§9) — never hardcode the domain in more than one place in the codebase.

**Required files in `apps/web/public/`:**
- `.nojekyll` — empty file, prevents GitHub Pages from suppressing `_next/` via Jekyll.
- `CNAME` — one line containing the custom subdomain (e.g. `tax.hubs.dpdns.org`, see §10 for naming). This value must equal `config.site.domain`. Without this file, every Pages deploy resets the custom domain setting.

---

## 3. Rendering model — hybrid static + client enhancement

Apply this pattern to every page type:

| Page type | Rendering strategy |
|---|---|
| Detail / content page | Fully static. `generateStaticParams` enumerates all IDs at build time. `generateMetadata` produces per-page title, description, OG image. No `'use client'` at the page level. |
| Listing / browse page | Thin static server shell (a few real `<a>` tags for crawlability + no-JS fallback) that hydrates into a rich client experience (search, filters, infinite scroll). |
| Tag / category page | Same pattern as a listing page, but auto-generated per tag/category value found in the data (see §15). |
| Blog post | Same pattern as a detail page (see §18). |
| Landing / home page | Static. Hero with a copy hook (§17), featured items, entry CTAs. |
| Sitemap | `app/sitemap.ts` — generated at build time across all content, tag, and blog URLs. Always include this. |

**Build-time data access rule:** At build time, read `data/**` and `content/**` directly from the filesystem using `fs`. Never `fetch()` local JSON at build time — it adds unnecessary HTTP overhead and fails in some CI environments. `fetch()` is only for client-side chunk loading at runtime.

**`output: export` hard constraint:** Every URL must be pre-generated at build time. If a URL is not emitted by `generateStaticParams`, it 404s. There is no ISR or on-demand rendering. Mitigate build time growth by caching `.next/cache` between CI runs (see §8).

---

## 4. TypeScript — strict mode everywhere

```json
// tsconfig.base.json (extended by all packages)
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "moduleResolution": "bundler",
    "target": "ES2022"
  }
}
```

**Rules:**
- `strict: true` is non-negotiable. Never disable it.
- No `any` unless explicitly casting with a comment explaining why.
- Infer types from Zod schemas with `z.infer<typeof Schema>` — do not write parallel manual types.
- Shared types live only in `packages/schema`. Never duplicate type definitions across packages.

---

## 5. Schema — Zod as the cross-boundary contract

Every record that crosses the ETL → web boundary must be defined as a Zod schema in `packages/schema` and validated at parse time in the ETL. This includes `config/site.ts` (§9) and blog frontmatter (§18) — anything structured that the build depends on.

**Pattern:**
```ts
// packages/schema/src/prompt.ts
import { z } from 'zod';
export const MyRecord = z.object({ ... });
export type MyRecord = z.infer<typeof MyRecord>;
```

**Rules:**
- The ETL runs `Schema.parse()` (throws) or `Schema.safeParse()` (catch + log) on every record.
- A validation script (`pnpm --filter etl run validate`) re-validates all committed chunk files. This runs in CI before any deploy.
- Schema changes are breaking changes. Version them deliberately.
- Include a `contentHash: z.string()` field on any record that participates in incremental diffing (sha1 of the normalized content fields, not the whole object including metadata).

---

## 6. Static data strategy — committed, versioned, idempotent

GitHub Pages has no server, no database, and no runtime API. All data must be available at build time as files in the repository or fetched client-side.

**Choose one of these patterns based on corpus size and update frequency:**

| Pattern | When to use | How |
|---|---|---|
| **Committed JSON** | < ~50 MB total, infrequent manual updates | Author/generate JSON files, commit to `data/`. Build reads directly via `fs`. |
| **CI-synced JSON** | Regularly updated from external source | Scheduled CI job fetches + normalizes + commits `data/**`. Deploy job triggers on that commit. |
| **Client-fetched JSON** | Large corpus, stale-on-load acceptable | Build generates an index/manifest; full data fetched in chunks at runtime via `fetch()`. |
| **External API** | Real-time data required | `fetch()` from client at runtime. Accept that content is invisible to crawlers; mitigate with SSG summary cards at build time. |

**Universal rules regardless of pattern:**
- **Stable IDs.** Never key records by position or rank. Use the upstream system's own permanent identifier. If none exists, derive a deterministic slug from the content (e.g. `slugify(title)`). Positional IDs break routing whenever the source is reordered.
- **Idempotent generation.** Running the generation/sync script twice must produce the same output. No timestamps in content hashes.
- **If nothing changed, write nothing.** Avoid committing zero-diff files — it pollutes `git log` and triggers unnecessary deploys.
- **Include a `contentHash`** on any record that participates in change detection. Compute as sha1/sha256 of the normalized content fields (not metadata like `lastSyncedAt`).
- **`data/` is generated; never hand-edit it.** Curation and overrides belong in a separate `overrides.json` (blocklist / patch file) that the generator reads and applies.

---

## 7. External data ingestion — safety rules

Whenever the application ingests data from an external source (API, scraped page, CSV, community-maintained file), apply these rules:

**Parsing:**
- Use a proper parser for the source format — never regex unstructured text. Markdown → `remark`, HTML → `node-html-parser` or `cheerio`, CSV → `papaparse`, JSON → `JSON.parse` + Zod validation.
- For date strings: use an explicit format (e.g. `date-fns/parse` with a format string). Never `new Date(untrustedString)` — locale-dependent and silently produces `Invalid Date`.

**Error isolation:**
- Wrap each record's extraction in `try/catch`. One malformed entry must never abort processing of the rest.
- Skip-and-log bad entries. Emit a run summary that lists every skipped entry with its error.
- Set a threshold: if skipped entries exceed N% of the run, fail CI and open a tracking issue. Silent degradation is unacceptable.

**Trust boundary:**
- Treat all external data as untrusted. Run Zod validation at the ingestion boundary before any record touches `data/` or the app.
- Sanitize any field that will be rendered as HTML (use `DOMPurify` client-side or a server-side equivalent). Never `dangerouslySetInnerHTML` raw external content.
- Strip or encode user-controlled URL fields before rendering as `href`. Validate scheme is `https:` or `http:` — reject `javascript:`, `data:`, etc.

---

## 8. CI/CD — build pipeline rigor

**`etl.yml` — data sync (mutates the repo):**
- Trigger: `schedule` (cron) + `workflow_dispatch`.
- Steps: install → sync → validate → build-index → auto-commit `data/**` if changed.
- Permissions: `contents: write`.
- Use `stefanzweifel/git-auto-commit-action` for the commit step — it is a no-op when nothing changed.
- Bot commit identity: a named bot user (e.g. `prompt-gallery-bot`) to keep `git log` readable.

**`deploy.yml` — build + deploy (reads the repo, produces artifact):**
- Trigger: `push` to `main` on paths `data/**`, `content/**`, `apps/web/**`, `packages/**`, `config/**` + `workflow_dispatch`.
- Permissions: `contents: read`, `pages: write`, `id-token: write`.
- Concurrency group: `pages` with `cancel-in-progress: true`.
- Steps: install → validate `config/site.ts` against its Zod schema (fail fast, see §9) → restore `.next/cache` → build → **bundle-size check** → **Lighthouse CI** → `touch out/.nojekyll` → `upload-pages-artifact` → `deploy-pages`.
- Use official `actions/upload-pages-artifact` + `actions/deploy-pages`. No third-party deploy actions.

**Build cache:**
```yaml
- uses: actions/cache@v4
  with:
    path: apps/web/.next/cache
    key: nextjs-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ github.sha }}
    restore-keys: |
      nextjs-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-
```
This is the primary lever for keeping build time sane as the corpus grows. Always include it.

**Lighthouse CI gate (required, not optional polish):**
```yaml
- name: Lighthouse CI
  uses: treosh/lighthouse-ci-action@v12
  with:
    urls: |
      ${{ steps.deploy_preview.outputs.url || 'http://localhost:3000/' }}
    budgetPath: ./lighthouserc.json
```
```jsonc
// lighthouserc.json — thresholds, tune once a real baseline is measured
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }]
      }
    }
  }
}
```
Treat a failing Lighthouse gate exactly like a failing test — never merge past it. This is what prevents the site from quietly degrading as content and JS grow.

**Bundle size budget:**
```jsonc
// .size-limit.json
[{ "path": ".next/static/chunks/*.js", "limit": "180 KB" }]
```
Run `size-limit` (or equivalent) in CI right after build, failing on regression past the limit. Measure the app's real baseline the first time and set the limit from that — don't guess a number up front.

**Dependency hygiene:** Add a `.github/renovate.json` (or Dependabot config) that groups minor/patch updates into a single weekly PR and flags major version bumps separately. The stack stays patchable without manual babysitting.

**Custom 404 page:** GitHub Pages serves a generic 404 by default. Next's static export already emits `out/404.html` automatically from `app/not-found.tsx` — the only requirement is that this page exists and is styled with the project's design tokens (§11) rather than left as the framework default.

**Drift alerting:** If the number of skipped/invalid records in an ETL run exceeds a threshold (e.g. 3 absolute or 1% of new entries), open or update a tracking GitHub Issue via `actions/github-script`. Silent failures are unacceptable.

---

## 9. Centralized configuration — one file for every key, link, and CTA

**Rule:** every external URL, tracking ID, price, CTA label, domain, and contact address lives in exactly one file: `config/site.ts`. Nothing else in the codebase hardcodes one of these values. This is what lets the person operating the site change a link or swap a key without touching application code.

```ts
// config/site.ts
import { z } from 'zod';

export const siteConfigSchema = z.object({
  site: z.object({
    name: z.string(),
    tagline: z.string(),
    domain: z.string(),          // e.g. 'tax.hubs.dpdns.org' — see §10
    url: z.string().url(),       // e.g. 'https://tax.hubs.dpdns.org'
    locale: z.string().default('en-US'),
    contactEmail: z.string().email(),
  }),
  social: z.object({
    twitter: z.string().default(''),   // '@handle' or '' to hide the icon
    github: z.string().default(''),
    linkedin: z.string().default(''),
    instagram: z.string().default(''),
    tiktok: z.string().default(''),
  }),
  seo: z.object({
    googleSiteVerification: z.string().default(''),   // content value for <meta name="google-site-verification">
    searchConsolePropertyUrl: z.string().default(''),  // the verified GSC property, e.g. 'https://tax.hubs.dpdns.org/'
    defaultOgImage: z.string().default('/og/default.png'),
  }),
  analytics: z.object({
    provider: z.enum(['cloudflare', 'ga4', 'none']).default('cloudflare'),
    gaMeasurementId: z.string().default(''),
    cloudflareToken: z.string().default(''),
  }),
  monetization: z.object({
    tipUrl: z.string().default(''),              // Buy Me a Coffee / Ko-fi
    stripePaymentLink: z.string().default(''),    // pay-per-asset, e.g. HD image $1
    newsletterEmbedUrl: z.string().default(''),   // email-gated download
    consultancyEmail: z.string().default(''),
    calendlyUrl: z.string().default(''),
  }),
  // AdSense gets its own block (not nested under monetization) because it drives
  // markup in the root layout (meta tag, script, ads.txt), not just a CTA component.
  adsense: z.object({
    publisherId: z.string().default(''),   // raw numeric ID ONLY — e.g. '1234567890123456'. No 'pub-' or 'ca-pub-' prefix.
    ready: z.boolean().default(false),     // flip true only once every item in the §21 pre-flight checklist is checked
  }),
  giscus: z.object({
    repo: z.string().default(''),
    repoId: z.string().default(''),
    category: z.string().default(''),
    categoryId: z.string().default(''),
  }),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export const config: SiteConfig = siteConfigSchema.parse({ /* literal values here */ });

// Every AdSense-facing format Google asks for is derived from the one raw ID above —
// never hand-type 'ca-pub-…' or 'pub-…' anywhere else in the codebase.
export const adsenseIds = {
  metaAndScript: config.adsense.publisherId ? `ca-pub-${config.adsense.publisherId}` : '',
  adsTxt: config.adsense.publisherId ? `pub-${config.adsense.publisherId}` : '',
};
```

**Rules:**
- Validate this file against `siteConfigSchema` in a `prebuild` script. A missing/invalid *required* field (e.g. `site.url`, `site.contactEmail`) fails the build with a clear message naming the field. Optional fields (social handles, monetization links) default to `''` and the consuming component must render a graceful disabled/hidden state, never a broken link.
- Code review check: grep the codebase for raw `https://`, `mailto:`, or tracking-ID-shaped strings outside `config/site.ts` — any hit outside a test file is a bug to fix before merge.
- Every other section below (branding, analytics, monetization, legal, SEO, AdSense, Search Console) reads from this file. None of them re-declare their own copy of a link or key.
- `config.adsense.publisherId` is the **one** place the AdSense ID gets pasted. §15 and §21 below both generate their respective artifacts (meta tag, script tag, `ads.txt`) from `adsenseIds`, derived above — never from a second hardcoded copy of the ID.

---

## 10. Domain & branding

**Subdomain naming convention:** all projects live under the `hubs.dpdns.org` umbrella as `<short-name>.hubs.dpdns.org`.
- If the user names a subdomain explicitly, use it as given.
- Otherwise, derive a short name (ideally ≤ 6 characters) from the idea's core noun, following the existing pattern (`TaxHubs` → `tax.hubs.dpdns.org`). Prefer one recognizable word over an acronym.
- Record the derived name as a resolved item (not an open question) in the implementation plan's §0, and set `config.site.domain` / `config.site.url` from it.

**Default visual direction:** unless the user specifies a theme, default to the Modern style defined by the design tokens in §11 — warm-neutral surfaces, one vibrant accent, generous whitespace, soft low-spread shadows.

**Brand assets to generate (build-time, not hand-drawn per page):**
- A wordmark/icon **SVG logo**, hand-coded using only the `accent` and `text` tokens, sized to stay crisp at both 32px (header) and 512px (app icon).
- A **social/OG banner** (1200×630), composited at build time from the logo + tagline + accent-colored background, using the same `satori`/`@napi-rs/canvas` approach as the per-page OG images in §15 — generate it programmatically, don't hand-draw a static asset per page.
- A **hero banner** variant for the homepage above-the-fold, consistent with the same asset system.

---

## 11. Design system — tokens first, components second

**Always define design tokens as CSS custom properties before writing any component.** Wire them into Tailwind via `theme.extend`.

**Baseline token set:**
```css
/* Light */
--bg: #FAFAF8;          /* warm off-white canvas */
--surface: #FFFFFF;
--surface-muted: #F2F2EF;
--text: #1A1A18;
--text-muted: #6B6B66;
--border: #E7E7E2;
--accent: #FF4D5E;       /* single vibrant accent */
--accent-contrast: #FFFFFF;

/* Dark (applied via .dark on <html>) */
--bg: #0E0E10;
--surface: #17171A;
--surface-muted: #202024;
--text: #F4F4F2;
--text-muted: #A1A1A8;
--border: #2A2A2E;
--accent: #FF5C6B;       /* slightly brighter for dark contrast */
```

**Theme strategy:**
- Dark mode via `class="dark"` on `<html>` (Tailwind `darkMode: 'class'`).
- Default resolves from `prefers-color-scheme` via a tiny inline `<script>` in `<head>` — runs before paint, eliminates theme flash (FOUC). This script reads `localStorage` and falls back to the media query.
- Manual toggle persists to `localStorage`.

**Typography:**
- UI font: `Inter` variable (or `Geist`) via `next/font/google`. Self-hosted, no external request.
- Monospace (code/prompt bodies): `JetBrains Mono` or `Geist Mono`.
- Use fluid `clamp()` type scale. Never fixed px font sizes.

**Motion rule:** Every transform, transition, and animation must be gated behind `@media (prefers-reduced-motion: no-preference)` or a `useReducedMotion` hook. Hover lifts, skeleton shimmers, and carousel animations all fall under this rule.

**Spacing:** 4px base scale (4/8/12/16/24/32/48/64). Masonry gutters: 16px desktop, 12px mobile.

**Radii:** cards `16px`, badges/pills `9999px`, buttons/inputs `12px`.

**Elevation:** Shadows are soft and low-spread. Never apply heavy resting shadows. Elevate only on hover/focus.

---

## 12. Component patterns

**Image pipeline (build-time, required for any idea with more than a handful of images):** because `images.unoptimized: true` disables Next's runtime image optimizer, run a `sharp` pass in the ETL/build step for every local or cached image — generate WebP/AVIF at 3–4 widths, write them alongside the source, and reference the generated `srcset` directly from a plain `<img>` (skip `next/image` for these assets). This is the single largest available performance lever in a static export; do not treat it as optional.

**Masonry gallery:**
- CSS `columns` as the baseline (works with no JS).
- Upgrade to JS-measured absolute-position masonry only when adding virtualization.
- Column counts: 2 → 3 → 4 → 5 → 6 across breakpoints (mobile → 2xl).
- Always reserve aspect-ratio space for images using parsed `width`/`height` to prevent CLS.

**Cards:**
- Image-dominant. The card is a `<a>` wrapping the whole tile.
- Overlay actions (Copy, Save, Share) are `<button>` elements inside the anchor — use `e.preventDefault()` + `stopPropagation()` as needed. Never nest `<a>` inside `<a>`.
- Lazy-load images (`loading="lazy"`). Provide a blur placeholder.

**Image viewer (only when the idea's content includes photos, screenshots, or infographics — skip for text/data-only ideas):**
- Every full-size image opens in a lightbox.
- Pinch-zoom + pan on touch, scroll/click-zoom on desktop, swipe or arrow-key navigation between items.
- A Download button that respects §21's hotlink/attribution rules — link the original asset URL rather than proxying it, unless the asset is self-hosted.
- Close on `Esc` or swipe-down. Test specifically in landscape phone orientation (§13) — lightboxes are the component most likely to overflow a short viewport.

**Share button (every item/detail page and every blog post):**
- One control that calls `navigator.share()` where supported (mobile), falling back to a small menu on desktop (copy link, plus 2–3 platforms relevant to the audience — X/Twitter, LinkedIn, WhatsApp, Facebook).
- Shares the canonical per-page URL and title already produced by §15's metadata — never a separate hand-written string.

**Social links (header or footer, pick one, not both):**
- An icon row driven entirely by `config.social` (§9). An icon renders only if its config value is non-empty; an empty value hides the icon rather than linking nowhere.

**Monetization CTAs** (see §20 for which pattern to choose): `<TipButton>`, `<BuyHDButton>`, `<ConsultancyCTA>`, `<NewsletterGate>`, `<AdSlot>` — each reads its destination from `config.monetization` and renders a disabled/"coming soon" state when the relevant field is empty, never a dead link.

**Comments (giscus):** for ideas where discussion adds value (galleries, prompt/resource libraries, opinionated lists), embed `giscus` on detail pages, configured from `config.giscus` (§9). No backend or moderation infra beyond what GitHub Discussions already provides. Skip it for purely utilitarian tools (calculators, lookups) where comments add noise rather than value.

**App bar:**
- Sticky, translucent, `backdrop-filter: blur(...)`.
- Collapse on scroll-down, reveal on scroll-up.
- Contains: logo, search input (`/` shortcut to focus), source/tool switcher, theme toggle.
- In landscape on a phone (short viewport, see §13), shrink to logo + search only to reclaim vertical space.

**Virtualization:** Use `@tanstack/react-virtual` for any list exceeding ~50 DOM nodes. Pair with TanStack Query for chunked data fetching.

**Search:**
- Index built at ETL time (FlexSearch or MiniSearch) over `title + description + promptText + author.name`.
- Lazy-load the index (fetch only when search input is focused).
- Run queries in a Web Worker — never block the main thread.

**Filter/facet state:** Drive entirely via URL query string (`?category=...&lang=...`). Filters must be shareable links. Parse on mount, push on change.

---

## 13. Responsive layout — portrait & landscape

Design and test every page in **both** portrait and landscape. Landscape on a phone is a wide-but-short viewport, not a small desktop — treat orientation as its own axis, not an afterthought of width-only breakpoints.

| Breakpoint | Width | Notes |
|---|---|---|
| Mobile portrait | 320–479px | Single column. Sticky app bar at full height. Bottom-anchored primary CTA where relevant. |
| Mobile landscape | 480–767px, viewport height < 500px | Shrink the app bar (logo + search only, see §12). Avoid full-height modals — use slide-overs instead. |
| Tablet | 768–1023px | 2–3 column grid. App bar at full height. |
| Desktop | 1024px+ | Full grid per §12's masonry column table. |

**Rules:**
- Use `@media (orientation: landscape)` alongside width breakpoints specifically for app-bar height and modal/lightbox sizing — width-only breakpoints miss the short-viewport landscape-phone case.
- Test the image viewer (§12) and any modal/lightbox in landscape phone specifically before calling a phase done — these overflow first.
- No horizontal overflow at any width from 320px up.

---

## 14. Accessibility — WCAG 2.1 AA minimum

These are not optional polish items. Enforce before shipping.

- Every interactive element has a visible focus ring (never `outline: none` without a custom replacement).
- Color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text and UI components — verified in both light and dark themes.
- All images carry meaningful `alt` text from the data. Decorative images: `alt=""` + `aria-hidden="true"`.
- Keyboard: full tab order, `Esc` closes any drawer/modal/lightbox, arrow keys navigate carousels, `/` focuses search.
- Semantic landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`. One `<h1>` per page. Logical heading hierarchy.
- FAQ accordions (§19) use `<details>/<summary>` or `<button aria-expanded>` — never a plain `<div onClick>`.
- Touch targets ≥ 44×44px on mobile.
- Responsive from 320px → ultrawide. No horizontal overflow.

---

## 15. SEO & discoverability

- `generateMetadata` on **every** static page — detail, listing, tag/category, and blog (§18), not just detail pages — must set: `title`, `description`, `openGraph: { title, description, images, url, type, siteName }`, and `twitter: { card: 'summary_large_image', title, description, images, site, creator }`. Populate `images` from the per-page dynamic OG generator below by default, falling back to `config.seo.defaultOgImage`.
- **Dynamic OG image per page** (not one static fallback for the whole site): pre-render a unique social-preview image at build time per page type (home, category, detail, blog), composited from the §10 brand assets + that page's title via `satori` or `@napi-rs/canvas`. A single generic OG image for the entire site measurably hurts social click-through — avoid it.
- **Tag/category pages**: auto-generate one static page per tag/category value found in the data (`app/tag/[tag]/page.tsx`), each with its own metadata and sitemap entry. This is free long-tail search surface from data already collected — don't skip it because it feels like extra routes.
- **`ItemList` JSON-LD** on every listing/category/tag page, in addition to the existing `Article`/`CreativeWork` schema on detail pages — required to unlock rich-result carousels for collections.
- `app/sitemap.ts`: generate across all content, tag, and blog URLs at build time. Include `lastModified` from the data's `publishedAt` or `lastSyncedAt`.
- Canonical URLs: always absolute, using `config.site.url`.
- Structured data (`application/ld+json`) on detail pages: `Article` or `CreativeWork` schema with `author`, `datePublished`, and `image`. Blog posts use `BlogPosting` (§18).
- **Search Console verification meta tag:** add `<meta name="google-site-verification" content={config.seo.googleSiteVerification}>` to the root layout — this is markup, generated from config like everything else here. The verification, sitemap submission, and indexing workflow itself (what to do once, what to automate, and two outdated shortcuts to avoid) is covered in §16.
- `robots.txt` must explicitly `Allow: /` and reference the sitemap URL.
- No client-side-only metadata. All SEO-critical content must be in the prerendered HTML.

---

## 16. Analytics & search engine verification

Pick **exactly one** analytics provider per project — both options below are free-tier:

| Provider | Cookie-based | Consent banner needed | Best for |
|---|---|---|---|
| **Cloudflare Web Analytics** | No | No | Default choice — privacy-friendly, zero legal overhead. |
| **Google Analytics 4** | Yes | Yes (§21) | Only when the idea specifically needs audience/funnel/ecommerce reporting. |

- Default to Cloudflare unless the idea clearly needs GA4's reporting depth.
- Load the analytics script using `config.analytics.provider` / `config.analytics.gaMeasurementId` / `config.analytics.cloudflareToken` (§9) — never hardcode an ID inline in a layout file.

**Google Search Console — verification, submission, and indexing.** This has one manual one-time step, one thing that needs no further action, and one optional CI automation. Do all three; skip the two shortcuts below them.

1. **Manual, once, by a human with account access (cannot be delegated to CI):** add the property in Search Console using the meta-tag method — `config.seo.googleSiteVerification` is the value Search Console gives you to paste, and it's already wired into the root layout by §15. Confirm the verified property matches `config.seo.searchConsolePropertyUrl` / `config.site.url` exactly (`https://` vs no scheme, trailing slash, and `www` vs no-`www` all count as different properties to Google).
2. **Needs no further action once `robots.txt` + `sitemap.xml` exist (§15):** Google's normal crawler discovers and periodically recrawls the sitemap on its own schedule. For a typical small launch, this alone is sufficient — most "make Google index my site faster" anxiety is solved by this step already being correct, not by additional tooling.
3. **Optional CI automation (the one genuinely automatable piece):** add a `deploy.yml` step that calls the official Search Console API's `sitemaps.submit` method (via `googleapis`, authenticated with a Google Cloud service account that has been added as a user on the property) right after a successful deploy. Store the service-account key as a GitHub Actions secret; never commit it. This nudges Google to refetch the sitemap promptly after each deploy — it's a courtesy ping through a supported, authenticated API, not a guarantee of faster indexing.

**Two shortcuts to deliberately avoid, even though older tutorials still recommend them:**
- The old public `https://www.google.com/ping?sitemap=...` endpoint. Google deprecated it at the end of 2023 — it now returns a 404 and does nothing. Don't add it to a workflow.
- The Google Indexing API for ordinary pages. Google restricts this API to pages carrying `JobPosting` or `BroadcastEvent` structured data; using it to force-index a blog post or listing page is outside its supported use and risks the project's API access being revoked without notice. None of this project's content types qualify — skip the Indexing API entirely.

If faster discovery genuinely matters beyond what the above gives you, the legitimate levers are: accurate `lastmod` values in the sitemap (§15), a homepage link to new content so it isn't an orphan page, and — for Bing/Yandex coverage specifically, not Google, which doesn't consume it — the IndexNow protocol.

---

## 17. Content & copywriting tone

Decide a single tone for all marketing copy — hero headline/subhead, CTA labels, blog voice (§18), FAQ phrasing (§19) — before writing any of it, and apply it consistently across the whole site.

| Signal in the idea prompt | Tone |
|---|---|
| Consumer, social, creative, youth-oriented, meme/pop-culture adjacent | **Gen Z** — short punchy sentences, second person, light emoji use, curiosity/FOMO hooks, conversational. |
| B2B, professional services, finance, legal, technical/data tools | **Professional** — benefit-led, authoritative, structured, trust/credibility signals, minimal emoji. |

If the idea doesn't clearly signal either, default to **Professional-but-warm** and state the choice explicitly in the implementation plan rather than silently guessing.

**Hero requirement:** every homepage hero needs a hook — a headline that creates curiosity, urgency, or a clear benefit in under ~8 words — a one-line subhead, and a single primary CTA above the fold. Avoid generic template copy ("Welcome to our platform").

---

## 18. Blog / content marketing section

Ship **3–4 launch blog posts** relevant to the idea's subject matter, written in the tone chosen in §17. This exists for two reasons: long-tail SEO surface area, and satisfying the "substantial original content" requirement for AdSense approval (§21).

**Implementation:** `content/blog/*.md` with frontmatter (`title, slug, description, publishedAt, tags, ogImage?`), parsed with the same remark + Zod pattern as §7, rendered via `generateStaticParams` exactly like any other content type. Each post gets full metadata (§15), a `BlogPosting` JSON-LD schema, and the same share button (§12) as item detail pages.

Pick the 3–4 topics from what the idea's actual audience would search for — e.g. a tax tool's launch posts should answer things a taxpayer actually googles, not "Welcome to our blog." Record the chosen topics in the implementation plan's §0.

---

## 19. FAQ section

Every project ships an FAQ — either a homepage section or a dedicated `/faq` page, whichever the page's content density suggests (a content-heavy gallery → dedicated page; a simple single-purpose tool → a homepage section is enough).

- 5–8 questions, accordion UI (`<details>/<summary>` or `<button aria-expanded>` — see §14).
- `FAQPage` JSON-LD covering the same Q&A pairs shown on the page — schema must match visible content exactly; don't add schema-only questions.

---

## 20. Monetization

**Rule:** every project ships with at least one monetization mechanism wired to a real or placeholder destination via `config.monetization` (§9). Never leave monetization as a TODO — implement the UI and the link/stub now; swapping the placeholder URL later costs zero code changes because everything reads from config.

| Pattern | Best for | No-backend implementation |
|---|---|---|
| Tip / support button | Any content site | Buy Me a Coffee / Ko-fi button → `config.monetization.tipUrl` |
| Pay-per-asset (e.g. HD image, $1) | Galleries, downloadable assets | Stripe Payment Link (hosted checkout, zero backend) → `config.monetization.stripePaymentLink`, gating a "Download HD" button |
| Email-gated download | Lead gen / freebies | Embed form from Buttondown/ConvertKit/Mailchimp → `config.monetization.newsletterEmbedUrl`; reveal the download after the embed's confirmation step |
| Consultancy / "Work with me" | Service-adjacent ideas | `mailto:` with prefilled subject/body, or a Calendly link, both from `config.monetization.consultancyEmail` / `.calendlyUrl` |
| Display ads | High-traffic content sites | `<AdSlot>` component, rendered only once `config.adsense.publisherId` is set **and** `config.adsense.ready` is true (see §21 for the technical setup + readiness checklist) |
| Affiliate links | Review/comparison content | `rel="sponsored noopener"` plus a visible disclosure line near the link — always together, never one without the other |

**Rules:**
- If a `config.monetization` field is empty, the corresponding component renders a graceful disabled/"coming soon" state — never a broken link or empty `href`.
- Pick the 1–2 patterns that actually fit the idea; don't bolt on all six. State the choice explicitly in the implementation plan's Guiding Principles.

---

## 21. Legal, attribution & compliance (AdSense-ready)

**Attribution (community-contributed content):**
- Surface `author.name` + `author.url` and `source.label` + `source.url` on every detail page.
- Render a visible footer credit: `"Data sourced from <upstream-repo>, CC BY 4.0"` with a link to the upstream repo and the license.
- Never re-host third-party CDN assets. Hotlink original URLs. Add an `onError` fallback placeholder.
- Handle content removal: if a record disappears from the upstream source, mark it `stale: true` in the chunk rather than deleting it — prevents dead URLs and allows graceful "no longer available" UI.

**Required static legal pages**, linked from the footer on every page:
- `/about` — what the site is, the niche it covers, who's behind it. This is a trust signal for human readers and, per the AdSense guidance below, a structural signal for automated review — don't skip it as "just" a content page.
- `/privacy` — Privacy Policy: what's collected (analytics, ad cookies if AdSense is enabled), which third parties are involved (Google Analytics/AdSense, Cloudflare), how to opt out, contact email.
- `/terms` — Terms of Service: usage rules, content ownership/license, disclaimer of warranty, link to attribution sources.
- `/cookies` — Cookie Policy (may be a section within the Privacy Policy) listing each cookie/tracker actually in use and its purpose.
- Footer also includes: Contact link, Sitemap link, and an Affiliate Disclosure line if §20's affiliate pattern is in use. Keep the footer nav itself short and flat (Home | category links | About | Contact | Privacy | Cookies) — a clean, shallow nav reads as more "ready to monetize" than a sprawling one, to a human or a bot.

Generate these pages from `config.site` (name, domain, contact email) and `config.monetization` / `config.analytics` / `config.adsense`, so the cookie list always matches what's actually wired up — never hand-write a cookie list disconnected from the real trackers.

**Cookie consent:**
- If `config.analytics.provider === 'ga4'`, render a minimal accept/decline banner before loading the GA script.
- If `config.analytics.provider === 'cloudflare'`, no banner is needed — Cloudflare Web Analytics is cookieless.

**Security headers via meta tag:** GitHub Pages gives no server-side header control, but a `<meta http-equiv="Content-Security-Policy">` in the root layout still works for most directives (`script-src`, `img-src`, `connect-src`, `frame-src`). Build the allow-list from what's actually wired up (analytics domain, giscus, the Stripe payment link domain, any hotlinked image hosts) and keep it driven by `config/site.ts` rather than hand-maintained separately. Treat a missing CSP the same as a missing `alt` rule — a default checklist item, not optional hardening reserved for "real" apps.

**AdSense technical setup — every artifact below is derived from the single `config.adsense.publisherId` (§9), never hand-typed a second time:**
- `public/ads.txt`, generated at build time: `google.com, ${adsenseIds.adsTxt}, DIRECT, f08c47fec0942fa0`. Skip writing the file entirely while `publisherId` is empty — a missing `ads.txt` is a non-issue pre-launch; a malformed one is a recurring AdSense alert.
- Root layout metadata: `other: { 'google-adsense-account': adsenseIds.metaAndScript }`, added only once `publisherId` is set. This is the meta-tag verification method — it confirms ownership without requiring a live ad slot on the homepage, which matters since most pages here are content pages, not ad inventory by default.
- The actual ad-serving script (`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseIds.metaAndScript}" crossorigin="anonymous">`) only renders once `config.adsense.ready === true` — i.e. after the checklist below passes and the account is actually approved. Loading the live script speculatively pre-approval adds an external request for no benefit.
- After deploy, confirm both artifacts are actually live before clicking anything in the AdSense dashboard: `curl -s https://<domain>/ads.txt` returns the expected line, and `curl -s https://<domain> | grep google-adsense-account` finds the meta tag. AdSense's own review reads whatever is live at crawl time, not what's in the repo.

**What actually predicts AdSense approval** (this reframes the checklist below, not a separate requirement): traffic volume is not part of the approval bar — a freshly registered domain with a solid run of original launch content can apply immediately; traffic only starts affecting *earnings* after approval, not the approval decision itself, so there's no reason to delay applying while waiting for visitors. Most reviews are automated rather than human, which means the system is reading structural and technical signals — clean markup, working links, consistent navigation — at least as much as it's reading prose quality; this is exactly why §8's Lighthouse gate and §14's accessibility rules double as AdSense-readiness work rather than separate concerns. Automated review reads whatever is actually live and cached at crawl time, so the last action before applying should always be: fix anything broken, redeploy, let any CDN cache clear, *then* apply — not apply against a stale build. A lean, semantically clean stack reviews better than a bloated one, which is one more reason §0's no-unrequested-dependency discipline and §12's component patterns matter here, not just for performance. Keeping the launch content (§18's blog topics, the site's stated niche) tightly scoped to one coherent subject reads as more trustworthy to an automated reviewer than a scattershot mix of unrelated topics. The underlying question any reviewer — automated or human — is answering is simply "can this be monetized cleanly": a focused, complete, navigable site answers yes; a half-finished one doesn't.

**AdSense pre-flight checklist** (must pass before `config.adsense.publisherId` is set, and `config.adsense.ready` flips to `true` only once every box is checked):
- [ ] `/about`, `/privacy`, `/terms`, `/cookies` (or merged), and a visible Contact method are all live and linked from a short, flat footer nav
- [ ] At least 3–4 blog posts (§18) live, all scoped to the site's one stated niche — substantial original content on a focused topic, not scattered filler
- [ ] No dead links, no broken pages — re-checked right before applying, against the live deployed site, not a cached or local view
- [ ] Lighthouse CI (§8) green and accessibility (§14) passing — automated review reads technical/structural cleanliness, not just prose
- [ ] `ads.txt` reachable at `/ads.txt` with the correct line, and the `google-adsense-account` meta tag present in the deployed HTML — both verified with `curl` against production, not assumed from the diff
- [ ] No ad slots placed on thin or duplicate-content pages
- [ ] Note: traffic is deliberately not on this list — it isn't part of the approval bar, so don't gate applying on accumulating visitors first.

---

## 22. Code style & commit conventions

- **Implementation discipline:** every change follows the decision ladder and rules in §0 (the ponytail standard) — reuse before writing, smallest correct diff, root-cause fixes, `ponytail:` comments on intentional shortcuts.
- **Formatter:** Prettier. Config at repo root. Run on save. Enforced in CI.
- **Linter:** ESLint with `@typescript-eslint/recommended`. No warnings in CI — all lint issues are errors.
- **Commits (human-authored):** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- **Bot commits:** Identified by author name (e.g. `prompt-gallery-bot`) with a `chore(data):` prefix. This keeps `git log` readable.
- **`data/` is generated.** Never hand-edit chunk files. Curation belongs in `data/<source>/overrides.json` (a blocklist by stable ID) that the ETL reads and respects.
- **Test framework:** Vitest. Snapshot tests for parsers against real saved fixture data. Unit tests for schema validation, ID-derivation logic, and the `config/site.ts` Zod schema.

---

## 23. PWA home-screen readiness & offline (Android-first)

When users should install the website to the Android home screen, treat this as a required deliverable, not optional polish.

**Required output:**
- A valid `manifest.webmanifest` with install metadata.
- High-resolution app icons (minimum `192x192` and `512x512`), generated from the §10 brand assets.
- Maskable icons (`purpose: maskable`) for adaptive launcher shapes.
- A standalone display mode (`display: 'standalone'`) and explicit `theme_color` / `background_color` for splash screen quality.
- Metadata wiring so the manifest is discoverable from all pages.

**Implementation baseline (Next.js App Router):**
- Add `app/manifest.ts` (or a static `public/manifest.webmanifest`) and include:
  - `name`, `short_name`, `description` (from `config.site`)
  - `start_url`, `scope`
  - `display: 'standalone'`
  - `orientation` (set to app intent, e.g. `'portrait'`)
  - `theme_color`, `background_color`
  - `icons` array with both regular and maskable PNGs
- Add `metadata.manifest = '/manifest.webmanifest'` in root layout metadata.
- Provide an Apple touch icon (`180x180`) for cross-platform install polish.

**Offline caching (in addition to install metadata above):** add a minimal Workbox-generated service worker that precaches the app shell (layout, fonts, critical CSS/JS) plus a "recently viewed" cache for item detail pages, so installed users can reopen recently seen content with no network. An installable icon that immediately shows an offline error is a broken promise — this closes that gap.

**Asset quality rules:**
- Icons must be sharp at 192 and 512 with no visible blur.
- Do not up-scale tiny source logos; generate vector-first (§10) or redraw assets at target sizes.
- Include mask-safe padding for maskable icons so critical artwork is not clipped by circles/squircles.
- Keep strong foreground/background contrast in both light and dark launch contexts.

**Validation checklist (must pass before merge):**
- `manifest.webmanifest` is reachable in production output.
- All icon URLs resolve with HTTP 200.
- Chrome DevTools > Application > Manifest shows no errors/warnings.
- Add-to-home-screen produces branded icon and standalone window.
- Android splash screen uses expected colors and icon, not a generic browser icon.

**Agent behavior requirement:**
- If the user asks for home-screen install quality, always implement this full checklist by default.
- If any item cannot be implemented with available tools, state the blocker and propose the exact fallback.

---

## 24. Implementation plan format

When asked to produce an implementation plan for a project matching this pattern, structure it as follows:

1. **§0 Source / data validation** — verify the upstream source before designing. Record confirmed facts that constrain the design (entry format, ID strategy, field locations, license), **and** resolve these project-level decisions up front: subdomain name (§10), `config/site.ts` field plan (§9 — which fields are real values vs. explicit placeholders), tone (§17), monetization pattern(s) chosen (§20), analytics provider (§16), whether the image viewer applies (§12), the 3–4 blog topics (§18), and the FAQ topics (§19).
2. **§0.N — How [specific constraint] is resolved** — for any non-obvious constraint, add a dedicated sub-section explaining the exact mechanism before listing tasks.
3. **Guiding principles** — enumerate the non-negotiable rules for the project, including which monetization pattern(s) and tone were chosen and why, and a one-line reminder that all implementation follows the §0 (ponytail) discipline: reuse first, smallest correct diff, root-cause fixes.
4. **Design system spec** — token values, theme strategy, typography, motion rules, and the brand assets to generate (logo, OG banner, hero banner — §10).
5. **Phases** — each phase is a flat list of checkboxes. One task = one checkbox. No nested subtasks more than one level deep. Include a phase (or section within an existing phase) for: build pipeline rigor (§8), config + branding setup (§9–10), responsive QA (§13), SEO/analytics/Search Console wiring (§15–16), blog + FAQ content (§18–19), monetization (§20), and legal/AdSense readiness (§21).
6. **Definition of done** — one checkbox per phase milestone. What "done" means must be observable (deployed URL, green CI including the Lighthouse/bundle gates, verified feature).
7. **Open questions** — unresolved decisions that would block implementation. Default items to include unless already answered in the prompt: subdomain name, monetization pattern, analytics provider, AdSense launch timeline. Mark resolved ones inline as they are answered.
8. **Immediate next steps** — the 5–7 actions needed right now to unblock Phase 1.

Checkbox states: `[ ]` not started · `[~]` in progress · `[x]` complete.
