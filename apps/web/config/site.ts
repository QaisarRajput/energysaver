import { SiteConfigSchema, type SiteConfig } from '@energysaver/schema';

const raw = {
  site: {
    name: 'EnergySaver',
    tagline: 'Run your appliances at the cheapest, greenest time — automatically.',
    domain: 'energysaver.hubs.dpdns.org',
    url: 'https://energysaver.hubs.dpdns.org',
    locale: 'en-GB',
    contactEmail: 'hello@energysaver.hubs.dpdns.org',
  },
  social: {
    twitter: '',
    github: '',
    linkedin: '',
    instagram: '',
    tiktok: '',
  },
  seo: {
    defaultTitle: 'EnergySaver — Cheapest & Greenest Time to Run Your Appliances',
    titleTemplate: '%s | EnergySaver',
    defaultDescription:
      'Find the cheapest, lowest-carbon hour to run your dryer, dishwasher, EV charger and more. Powered by live UK carbon intensity and Agile electricity prices.',
    defaultOgImage: '/og/home.png',
    gscVerification: '', // placeholder — add Google Search Console token here
  },
  analytics: {
    provider: 'cloudflare' as const,
    cloudflareToken: '', // placeholder — add Cloudflare Web Analytics token here
  },
  monetization: {
    tipUrl: '', // placeholder — e.g. 'https://ko-fi.com/...' or 'https://buymeacoffee.com/...'
    affiliateTag: '', // placeholder — e.g. Amazon Associates tag
  },
  adsense: {
    publisherId: '', // placeholder — add once approved
    ready: false,
  },
  giscus: {
    repo: '',
    repoId: '',
    category: '',
    categoryId: '',
  },
  data: {
    carbonApiBase: 'https://api.carbonintensity.org.uk',
    octopusApiBase: 'https://api.octopus.energy',
    agileProductCode: 'AGILE-24-10-01',
  },
};

// Validate at import time so the prebuild step catches any missing required fields.
export const siteConfig: SiteConfig = SiteConfigSchema.parse(raw);

/** Helper: derive the publisher ID-based adsense script src — only when ready. */
export function adsenseIds(): { publisherId: string; scriptSrc: string } | null {
  if (!siteConfig.adsense.ready || !siteConfig.adsense.publisherId) return null;
  return {
    publisherId: siteConfig.adsense.publisherId,
    scriptSrc: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${siteConfig.adsense.publisherId}`,
  };
}
