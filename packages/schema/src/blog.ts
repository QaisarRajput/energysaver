import { z } from 'zod';

export const BlogFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  slug: z.string(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
});

export type BlogFrontmatter = z.infer<typeof BlogFrontmatterSchema>;
