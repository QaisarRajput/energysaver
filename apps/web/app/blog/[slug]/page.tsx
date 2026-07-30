import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { siteConfig } from '../../../config/site';

// ponytail: blog posts are static markdown files. We parse frontmatter and render the body
// as HTML using a simple regex strip. Upgrade to remark/rehype for proper Markdown rendering
// when the post count grows or MDX features are needed.

interface Post {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  body: string;
}

const BLOG_DIR = resolve(process.cwd(), '../../content/blog');

const SLUGS = [
  'what-is-carbon-intensity',
  'how-much-can-load-shifting-save',
  'agile-vs-economy-7',
  'ev-cheapest-charging-hours',
];

function loadPost(slug: string): Post | null {
  const filePath = resolve(BLOG_DIR, `${slug}.md`);
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, 'utf-8');
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) return null;

  const fm = frontmatterMatch[1] ?? '';
  const body = frontmatterMatch[2] ?? '';

  const get = (key: string): string => {
    const m = fm.match(new RegExp(`^${key}:\\s*"([^"]*)"`, 'm'));
    return m?.[1] ?? '';
  };

  return {
    slug,
    title: get('title'),
    description: get('description'),
    publishedAt: get('publishedAt'),
    body,
  };
}

export function generateStaticParams(): { slug: string }[] {
  return SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = loadPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: `${post.title} | ${siteConfig.site.name}`,
      description: post.description,
      url: `${siteConfig.site.url}/blog/${slug}`,
      type: 'article',
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = loadPost(slug);
  if (!post) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    url: `${siteConfig.site.url}/blog/${slug}`,
    publisher: {
      '@type': 'Organization',
      name: siteConfig.site.name,
      url: siteConfig.site.url,
    },
  };

  // Minimal markdown → HTML conversion for headings, bold, italic, links, tables, code
  // ponytail: this covers the post format in use. Add remark/rehype for full GFM support.
  function renderMarkdown(md: string): string {
    return md
      .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold text-[var(--text)] mt-6 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-semibold text-[var(--text)] mt-8 mb-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-[var(--text)] mt-8 mb-4">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="font-mono text-sm bg-[var(--border)] px-1 rounded">$1</code>')
      .replace(/^\| (.+) \|$/gm, (line) => {
        if (line.includes('---')) return '<tr class="border-b border-[var(--border)]"></tr>';
        const cells = line.slice(2, -2).split(' | ').map((c) =>
          `<td class="px-3 py-2 text-sm text-[var(--text-muted)]">${c}</td>`
        ).join('');
        return `<tr class="border-b border-[var(--border)]">${cells}</tr>`;
      })
      .replace(/(<tr[^>]*>.*<\/tr>\n?)+/g, (block) =>
        `<div class="overflow-x-auto my-4"><table class="w-full border border-[var(--border)] rounded-lg border-collapse">${block}</table></div>`
      )
      .replace(/\n\n/g, '</p><p class="text-[var(--text-muted)] leading-relaxed mb-4">')
      .replace(/^(?!<[h|t|d])/, '<p class="text-[var(--text-muted)] leading-relaxed mb-4">')
      + '</p>';
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-sm text-[var(--text-muted)] mb-6">
        <a href="/blog" className="hover:text-[var(--accent)]">← Blog</a>
      </nav>

      <time dateTime={post.publishedAt} className="text-xs text-[var(--text-muted)]">
        {post.publishedAt}
      </time>
      <h1 className="text-3xl font-bold text-[var(--text)] mt-2 mb-6">{post.title}</h1>

      <article
        className="prose-like"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
      />
    </main>
  );
}
