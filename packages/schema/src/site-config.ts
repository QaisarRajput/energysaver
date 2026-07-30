import { z } from 'zod';

export const SiteConfigSchema = z.object({
  site: z.object({
    name: z.string(),
    tagline: z.string(),
    domain: z.string(),
    url: z.string().url(),
    locale: z.string().default('en-GB'),
    contactEmail: z.string().email(),
  }),
  social: z.object({
    twitter: z.string().default(''),
    github: z.string().default(''),
    linkedin: z.string().default(''),
    instagram: z.string().default(''),
    tiktok: z.string().default(''),
  }),
  seo: z.object({
    defaultTitle: z.string(),
    titleTemplate: z.string(), // e.g. '%s | EnergySaver'
    defaultDescription: z.string(),
    defaultOgImage: z.string(),
    gscVerification: z.string().default(''),
  }),
  analytics: z.object({
    provider: z.enum(['cloudflare', 'none']),
    cloudflareToken: z.string().default(''),
  }),
  monetization: z.object({
    tipUrl: z.string().default(''),
    affiliateTag: z.string().default(''),
  }),
  adsense: z.object({
    publisherId: z.string().default(''),
    ready: z.boolean().default(false),
  }),
  giscus: z.object({
    repo: z.string().default(''),
    repoId: z.string().default(''),
    category: z.string().default(''),
    categoryId: z.string().default(''),
  }),
  data: z.object({
    carbonApiBase: z.string().url().default('https://api.carbonintensity.org.uk'),
    octopusApiBase: z.string().url().default('https://api.octopus.energy'),
    // Default Agile product code — can be overridden in config when a new one is released
    agileProductCode: z.string().default('AGILE-24-10-01'),
  }),
});

export type SiteConfig = z.infer<typeof SiteConfigSchema>;
