import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-[var(--bg)]">
      <h1 className="text-6xl font-mono font-bold text-[var(--accent)]">404</h1>
      <p className="text-xl text-[var(--text)] mt-4">Page not found</p>
      <p className="text-[var(--text-muted)] mt-2 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center px-6 py-3 bg-[var(--accent)] text-white font-semibold rounded-xl hover:bg-[var(--accent-hover)] transition-colors"
      >
        Go home
      </Link>
    </main>
  );
}
