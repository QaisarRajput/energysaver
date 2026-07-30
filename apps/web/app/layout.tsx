import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { siteConfig } from '../config/site';
import { SiteHeader } from '../components/SiteHeader';
import { NotificationBanner } from '../components/NotificationBanner';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.site.url),
  title: {
    default: siteConfig.seo.defaultTitle,
    template: siteConfig.seo.titleTemplate,
  },
  description: siteConfig.seo.defaultDescription,
  openGraph: {
    type: 'website',
    locale: siteConfig.site.locale,
    url: siteConfig.site.url,
    siteName: siteConfig.site.name,
    images: [{ url: siteConfig.seo.defaultOgImage }],
  },
  robots: { index: true, follow: true },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: siteConfig.site.name,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  ...(siteConfig.seo.gscVerification && {
    verification: { google: siteConfig.seo.gscVerification },
  }),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        {/* Theme init — reads localStorage, falls back to prefers-color-scheme. Inline to prevent FOUC. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        {process.env.NODE_ENV === 'production' && (
          <meta httpEquiv="Content-Security-Policy" content={buildCsp()} />
        )}
        {siteConfig.analytics.cloudflareToken && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token":"${siteConfig.analytics.cloudflareToken}"}`}
          />
        )}
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <SiteHeader />
        {children}
        <NotificationBanner />
      </body>
    </html>
  );
}

function buildCsp(): string {
  const self = "'self'";
  const none = "'none'";
  const unsafeInline = "'unsafe-inline'"; // needed only for the theme init script
  const apiHosts = [siteConfig.data.carbonApiBase, siteConfig.data.octopusApiBase].join(' ');
  const analyticsHost = siteConfig.analytics.cloudflareToken
    ? 'https://static.cloudflareinsights.com'
    : '';
  const tipHost = siteConfig.monetization.tipUrl
    ? new URL(siteConfig.monetization.tipUrl).origin
    : '';

  return [
    `default-src ${self}`,
    `script-src ${self} ${unsafeInline}${analyticsHost ? ' ' + analyticsHost : ''}`,
    `connect-src ${self} ${apiHosts}${analyticsHost ? ' ' + analyticsHost : ''}`,
    `style-src ${self} ${unsafeInline}`,
    `img-src ${self} data:`,
    `font-src ${self}`,
    `frame-src ${none}`,
    `object-src ${none}`,
    `base-uri ${self}`,
    ...(tipHost ? [`form-action ${self} ${tipHost}`] : [`form-action ${self}`]),
  ].join('; ');
}
