import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for EnergySaver — what data we collect and why.',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[var(--text)] mb-6">Privacy Policy</h1>
      <div className="space-y-4 text-[var(--text-muted)] text-sm leading-relaxed">
        <p className="text-[var(--text)]">Last updated: July 2026</p>

        <h2 className="text-lg font-semibold text-[var(--text)]">What we collect</h2>
        <p>
          EnergySaver is a client-side static web app. We do not operate servers, databases, or
          user accounts. We do not collect, store, or process personal data directly.
        </p>

        <h2 className="text-lg font-semibold text-[var(--text)]">Analytics</h2>
        <p>
          We use <strong>Cloudflare Web Analytics</strong>, which is cookieless and does not track
          individual users across sessions or sites. No personal data is shared with Cloudflare for
          this purpose beyond the page-view event metadata.
        </p>

        <h2 className="text-lg font-semibold text-[var(--text)]">External APIs</h2>
        <p>
          When you use the calculator, your browser fetches data directly from the Carbon Intensity
          API (carbonintensity.org.uk) and, if you select Agile, from api.octopus.energy. Your
          postcode (if entered) is sent to these APIs to retrieve regional data. We do not intercept
          or store this traffic.
        </p>

        <h2 className="text-lg font-semibold text-[var(--text)]">Local storage</h2>
        <p>
          We store your dark/light mode preference in <code>localStorage</code>. No other data is
          persisted on your device by us.
        </p>

        <h2 className="text-lg font-semibold text-[var(--text)]">Affiliate links</h2>
        <p>
          Some links to external products use affiliate codes. Clicking these may set cookies on
          the destination site (e.g. Amazon). We do not control those third-party cookies.
        </p>

        <h2 className="text-lg font-semibold text-[var(--text)]">Contact</h2>
        <p>
          Questions about privacy? Email us at{' '}
          <a href="mailto:hello@energysaver.hubs.dpdns.org" className="text-[var(--accent)] underline">
            hello@energysaver.hubs.dpdns.org
          </a>
          .
        </p>
      </div>
    </main>
  );
}
