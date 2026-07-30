import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Practical guides on UK home energy timing, tariffs, and load-shifting.',
};

// ponytail: blog posts hardcoded here for now. Move to remark + generateStaticParams
// when the number of posts grows or frontmatter parsing is needed for RSS.
const posts = [
  {
    slug: 'what-is-carbon-intensity',
    title: 'What is carbon intensity — and why 2am electricity is cleaner than 6pm',
    description:
      'The UK grid mixes fossil fuels and renewables throughout the day. Here\'s what carbon intensity means and why shifting your laundry to overnight can cut its carbon footprint by half.',
    publishedAt: '2026-07-01',
  },
  {
    slug: 'how-much-can-load-shifting-save',
    title: 'How much can shifting your dryer, dishwasher & washing machine actually save?',
    description:
      'We ran the numbers for three common household appliances across Economy 7, Agile, and flat-rate tariffs. Here\'s what a year of load-shifting is actually worth.',
    publishedAt: '2026-07-08',
  },
  {
    slug: 'agile-vs-economy-7',
    title: 'Octopus Agile vs Economy 7: which suits a load-shifter?',
    description:
      'Both tariffs offer cheap overnight electricity — but their structures are very different. Which one gives the biggest savings for flexible households?',
    publishedAt: '2026-07-15',
  },
  {
    slug: 'ev-cheapest-charging-hours',
    title: 'EV owners: the cheapest, greenest hours to charge in the UK',
    description:
      'Home EV charging is the single largest flexible load most households will ever have. Here\'s exactly when to plug in to minimise cost and carbon.',
    publishedAt: '2026-07-22',
  },
];

export default function BlogPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[var(--text)] mb-2">Blog</h1>
      <p className="text-[var(--text-muted)] mb-8">
        Practical UK energy timing guides — no jargon, concrete numbers.
      </p>

      <ul className="space-y-6 list-none p-0">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="block p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)] transition-colors group"
            >
              <p className="text-xs text-[var(--text-muted)] mb-1">{post.publishedAt}</p>
              <h2 className="text-lg font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                {post.title}
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-2">{post.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
