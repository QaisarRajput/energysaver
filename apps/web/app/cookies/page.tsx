import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'Cookie and local storage policy for EnergySaver.',
};

export default function CookiesPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[var(--text)] mb-6">Cookies &amp; Local Storage</h1>
      <div className="space-y-4 text-[var(--text-muted)] text-sm leading-relaxed">
        <h2 className="text-lg font-semibold text-[var(--text)]">Our site</h2>
        <p>
          EnergySaver does not set cookies. We store only one item in your browser&apos;s{' '}
          <code>localStorage</code>: your dark/light mode preference (key: <code>theme</code>).
          This is never transmitted anywhere.
        </p>

        <h2 className="text-lg font-semibold text-[var(--text)]">Analytics</h2>
        <p>
          We use <strong>Cloudflare Web Analytics</strong> — a cookieless analytics service. It
          does not place cookies in your browser and does not track you across sites.
        </p>

        <h2 className="text-lg font-semibold text-[var(--text)]">Third-party links</h2>
        <p>
          If you follow affiliate links to external sites (e.g. Amazon), those sites may set their
          own cookies. We have no control over third-party cookies. Please refer to their privacy
          policies for details.
        </p>

        <h2 className="text-lg font-semibold text-[var(--text)]">No consent banner</h2>
        <p>
          Because we do not set cookies ourselves, and our analytics are cookieless, we do not
          show a cookie consent banner. If you have concerns, you can disable JavaScript — the
          site remains fully readable without it.
        </p>
      </div>
    </main>
  );
}
