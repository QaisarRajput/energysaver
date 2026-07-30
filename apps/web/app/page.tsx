import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '../config/site';
import appliancesRaw from '../../../data/appliances.json';
import { ApplianceSchema } from '@energysaver/schema';
import type { Appliance } from '@energysaver/schema';
import { CarbonGauge } from '../components/CarbonGauge';
import { ForecastGrid } from '../components/ForecastGrid';

export const metadata: Metadata = {
  title: siteConfig.seo.defaultTitle,
  description: siteConfig.seo.defaultDescription,
};

const appliances: Appliance[] = (appliancesRaw as unknown[]).flatMap((a) => {
  const r = ApplianceSchema.safeParse(a);
  return r.success ? [r.data] : [];
});

/** Decorative SVG illustration — abstract landscape in Carbonex palette */
function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 520 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-hidden="true"
    >
      {/* Pink sky */}
      <rect width="520" height="420" fill="#f9c5bd" opacity="0.35" rx="24" />

      {/* Purple mountains background */}
      <ellipse cx="380" cy="180" rx="280" ry="200" fill="#8076a3" opacity="0.12" />
      <path d="M0 300 Q80 160 200 220 Q320 280 420 160 Q480 100 520 140 L520 420 L0 420Z" fill="#8076a3" opacity="0.18" />

      {/* Green rolling hills foreground */}
      <path d="M0 340 Q100 280 200 310 Q300 340 420 290 Q470 270 520 300 L520 420 L0 420Z" fill="#9bc400" opacity="0.65" />
      <path d="M0 370 Q130 330 260 355 Q380 375 520 340 L520 420 L0 420Z" fill="#9bc400" opacity="0.9" />

      {/* White organic swirl (like Carbonex smoke) */}
      <path
        d="M120 420 C120 350 90 300 130 260 C170 220 240 230 260 190 C280 150 250 90 290 60"
        stroke="white"
        strokeWidth="40"
        strokeLinecap="round"
        opacity="0.55"
        fill="none"
      />

      {/* Factory silhouette */}
      <rect x="310" y="310" width="28" height="90" fill="#7c677f" opacity="0.6" rx="3" />
      <rect x="350" y="340" width="22" height="60" fill="#7c677f" opacity="0.5" rx="3" />
      {/* Smokestacks top bands */}
      <rect x="308" y="310" width="32" height="10" fill="#8076a3" opacity="0.4" rx="2" />
      <rect x="348" y="340" width="26" height="8" fill="#8076a3" opacity="0.4" rx="2" />

      {/* Clock/leaf motif — brand element floating */}
      <circle cx="420" cy="120" r="50" stroke="#8076a3" strokeWidth="3" opacity="0.4" fill="none" />
      <path d="M420 120 C412 108 415 95 430 93 C432 108 427 120 420 120Z" fill="#9bc400" opacity="0.5" />
      <line x1="420" y1="120" x2="420" y2="96" stroke="#8076a3" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      <line x1="420" y1="120" x2="437" y2="120" stroke="#8076a3" strokeWidth="3" strokeLinecap="round" opacity="0.5" />

      {/* Dots pattern */}
      {[0,1,2,3,4].map((row) =>
        [0,1,2,3].map((col) => (
          <circle
            key={`${row}-${col}`}
            cx={60 + col * 28}
            cy={60 + row * 28}
            r="2.5"
            fill="#8076a3"
            opacity="0.25"
          />
        ))
      )}
    </svg>
  );
}

export default function HomePage() {
  return (
    <main>
      {/* ── HERO ── Carbonex-style: pink bg, bold left text, illustration right */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #fdf5f3 0%, #f9c5bd 40%, #ede0f5 100%)' }}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-16 md:py-24 grid md:grid-cols-[1fr_1fr] gap-12 items-center">
          {/* Left: text */}
          <div>
            <p className="eyebrow mb-4">Smart Home Energy</p>
            <h1
              className="display-heading text-5xl md:text-6xl lg:text-7xl mb-6 leading-[0.95]"
              style={{ color: '#2d2640' }}
            >
              Solving the<br />
              <span style={{ color: '#8076a3' }}>Energy</span><br />
              Puzzle.
            </h1>
            <p className="text-base md:text-lg leading-relaxed mb-8 max-w-md" style={{ color: '#7c677f' }}>
              EnergySaver tells you the exact hour to run your appliances — cheaper costs, lower carbon, zero guesswork. Built on live UK grid data.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/calculator"
                className="btn-pill inline-flex items-center gap-2 px-7 py-3.5 text-white shadow-green"
                style={{ background: '#9bc400' }}
              >
                FIND MY BEST TIME
              </Link>
              <Link
                href="/appliances"
                className="btn-pill inline-flex items-center gap-2 px-7 py-3.5 border-2"
                style={{ borderColor: '#8076a3', color: '#8076a3' }}
              >
                BROWSE APPLIANCES
              </Link>
            </div>
            <p className="mt-5 text-xs" style={{ color: '#7c677f', opacity: 0.7 }}>
              GB only (England, Scotland & Wales) · Northern Ireland not covered by Carbon Intensity API
            </p>
          </div>

          {/* Right: illustration */}
          <div className="relative hidden md:block h-[380px]">
            <HeroIllustration />
          </div>
        </div>

        {/* Stats bar */}
        <div
          className="border-t"
          style={{ borderColor: 'rgba(128,118,163,0.15)', background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(8px)' }}
        >
          <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { num: '48h', label: 'Live Forecast' },
              { num: '110', label: 'UK Regions' },
              { num: '8', label: 'Appliances' },
              { num: '0p', label: 'Cost to Use' },
            ].map(({ num, label }) => (
              <div key={label} className="flex items-baseline gap-3">
                <span
                  className="font-black text-4xl md:text-5xl leading-none"
                  style={{ color: '#9bc400', letterSpacing: '-0.03em' }}
                >
                  {num}
                </span>
                <span className="text-sm leading-tight" style={{ color: '#7c677f' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE GAUGE ── */}
      <section className="max-w-5xl mx-auto px-6 md:px-10 py-14">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="eyebrow mb-1">Live Data</p>
            <h2 className="text-3xl font-black" style={{ color: '#2d2640', letterSpacing: '-0.02em' }}>
              Right Now in GB
            </h2>
          </div>
          <Link href="/calculator" className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold" style={{ color: '#9bc400' }}>
            Open Calculator →
          </Link>
        </div>
        <CarbonGauge />
      </section>

      {/* ── 48H GRID ── soft purple surface */}
      <section style={{ background: 'linear-gradient(180deg, #f4f1f8 0%, #fdf5f3 100%)' }}>
        <div className="max-w-5xl mx-auto px-6 md:px-10 py-14">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="eyebrow mb-1">Forecast</p>
              <h2 className="text-3xl font-black" style={{ color: '#2d2640', letterSpacing: '-0.02em' }}>
                Next 48 Hours
              </h2>
            </div>
            <Link href="/planner" className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold" style={{ color: '#8076a3' }}>
              Plan your day →
            </Link>
          </div>
          <ForecastGrid />
        </div>
      </section>

      {/* ── APPLIANCES ── */}
      <section className="max-w-5xl mx-auto px-6 md:px-10 py-14">
        <div className="mb-8">
          <p className="eyebrow mb-1">Common Appliances</p>
          <h2 className="text-3xl font-black" style={{ color: '#2d2640', letterSpacing: '-0.02em' }}>
            What can you optimise?
          </h2>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 list-none p-0">
          {appliances.map((a) => (
            <li key={a.id}>
              <Link
                href={`/appliances/${a.id}?from=home`}
                className="group flex flex-col p-5 rounded-2xl border-2 transition-all hover:shadow-card-hover hover:border-[#9bc400]"
                style={{ borderColor: '#e8e0f0', background: '#ffffff' }}
              >
                <span
                  className="block text-3xl font-black leading-none mb-2"
                  style={{ color: '#9bc400', letterSpacing: '-0.02em' }}
                >
                  {a.powerKw}
                  <span className="text-base font-semibold ml-1" style={{ color: '#7c677f' }}>kW</span>
                </span>
                <span className="block font-bold text-sm mt-auto" style={{ color: '#2d2640' }}>
                  {a.name}
                </span>
                <span className="block text-xs mt-0.5" style={{ color: '#7c677f' }}>
                  {a.defaultRunHours}h typical
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background: 'linear-gradient(180deg, #f9c5bd 0%, #fdf5f3 100%)' }}>
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-16" aria-label="Frequently asked questions">
          <div className="mb-10">
            <p className="eyebrow mb-1">FAQ</p>
            <h2 className="text-3xl font-black" style={{ color: '#2d2640', letterSpacing: '-0.02em' }}>
              Frequently Asked Questions
            </h2>
          </div>
          <Faq />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#2d2640', color: '#9d8ca4' }} className="py-12 px-6 md:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-6 mb-8">
            <span className="font-black text-2xl" style={{ color: '#ffffff', letterSpacing: '-0.02em' }}>
              Energy<span style={{ color: '#9bc400' }}>Saver</span>
            </span>
            <nav className="flex flex-wrap gap-6 text-sm" aria-label="Footer navigation">
              {[
                ['/calculator', 'Calculator'],
                ['/planner', 'Day Planner'],
                ['/appliances', 'Appliances'],
                ['/blog', 'Blog'],
                ['/tariffs', 'Tariffs'],
                ['/about', 'About'],
                ['/privacy', 'Privacy'],
                ['/terms', 'Terms'],
              ].map(([href, label]) => (
                <Link
                  key={href!}
                  href={href!}
                  className="transition-colors hover:text-[#9bc400]"
                  style={{ color: '#9d8ca4' }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="border-t pt-6 text-xs space-y-2" style={{ borderColor: 'rgba(157,140,164,0.2)' }}>
            <p>
              Carbon intensity data:{' '}
              <a href="https://carbonintensity.org.uk" rel="noopener noreferrer" className="underline" style={{ color: '#9bc400' }}>
                Carbon Intensity API
              </a>{' '}
              © National Energy System Operator, CC BY 4.0.
            </p>
            {siteConfig.monetization.affiliateTag && (
              <p>Some links are affiliate links. We may earn a small commission at no extra cost to you.</p>
            )}
          </div>
        </div>
      </footer>
    </main>
  );
}

function Faq() {
  const items = [
    { q: 'How accurate are the savings estimates?', a: 'Estimates are illustrative based on typical appliance power draw and published tariff rates — not billing-accurate. Actual savings depend on your exact appliance, tariff terms, and grid conditions. See our Terms for full disclaimers.' },
    { q: 'Why does it only cover Great Britain and not Northern Ireland?', a: 'The Carbon Intensity API covers England, Scotland, and Wales. Northern Ireland operates a separate electricity market and is not included in this data source.' },
    { q: 'Do I need a smart meter to use this?', a: "No. The tool works for any UK household. A smart meter lets you see your actual usage in-app, but it isn't required — we use typical appliance wattage figures." },
    { q: 'What is Octopus Agile and should I switch?', a: "Agile is a half-hourly variable tariff from Octopus Energy where prices track the wholesale electricity market. It rewards flexibility — running appliances when prices are cheapest. We show a tariff comparison on the calculator." },
    { q: 'Where does the data come from?', a: 'Carbon intensity forecasts come from the NESO Carbon Intensity API. Agile electricity prices come from the Octopus Energy API. Both are fetched live in your browser — your postcode is never sent to our servers.' },
    { q: 'Is my postcode stored anywhere?', a: 'No. Your postcode is only used in your browser to look up your grid region and fetch the appropriate forecast. It is not sent to our servers or stored.' },
    { q: 'How are the savings calculated?', a: "We compare the cost and carbon intensity of running your appliance in the recommended window against a default evening peak (17:00–20:00). See our Terms for full methodology notes." },
  ];

  return (
    <dl className="space-y-3">
      {items.map(({ q, a }) => (
        <details
          key={q}
          className="group rounded-2xl overflow-hidden"
          style={{ border: '2px solid rgba(128,118,163,0.2)', background: 'rgba(255,255,255,0.7)' }}
        >
          <summary className="font-bold text-sm cursor-pointer list-none flex items-center justify-between px-5 py-4" style={{ color: '#2d2640' }}>
            {q}
            <span className="ml-2 shrink-0 w-6 h-6 rounded-full flex items-center justify-center group-open:rotate-180 transition-transform text-xs" style={{ background: '#8076a3', color: 'white' }}>
              ▾
            </span>
          </summary>
          <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: '#7c677f' }}>{a}</p>
        </details>
      ))}
    </dl>
  );
}

