import type { MetadataRoute } from 'next';
import { siteConfig } from '../config/site';
import appliancesRaw from '../../../data/appliances.json';
import { ApplianceSchema } from '@energysaver/schema';

export const dynamic = 'force-static';

const appliances = (appliancesRaw as unknown[]).flatMap((a) => {
  const r = ApplianceSchema.safeParse(a);
  return r.success ? [r.data] : [];
});

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.site.url;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/calculator`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/appliances`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/tariffs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/planner`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${base}/cookies`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];

  const applianceRoutes: MetadataRoute.Sitemap = appliances.map((a) => ({
    url: `${base}/appliances/${a.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...applianceRoutes];
}
