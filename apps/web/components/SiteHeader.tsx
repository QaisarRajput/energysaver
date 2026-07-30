'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';

const NAV_LINKS = [
  { href: '/', label: 'About Us' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/planner', label: 'Day Planner' },
  { href: '/appliances', label: 'Appliances' },
  { href: '/blog', label: 'Blog' },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const isDark = document.documentElement.classList.toggle('dark');
    setDark(isDark);
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-9 h-9 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--purple)] hover:border-[var(--green)] hover:text-[var(--green)] transition-colors"
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      role="banner"
      className="fixed top-0 left-0 right-0 z-50 h-[64px] bg-[var(--bg)] border-b border-[var(--border)] flex items-center px-6 md:px-10"
    >
      {/* Logo */}
      <Link href="/" className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] rounded">
        <Logo size="sm" />
      </Link>

      {/* Desktop nav — centre */}
      <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-8 flex-1 justify-center">
        {NAV_LINKS.map(({ href, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] rounded ${
                active
                  ? 'text-[#9bc400]'
                  : 'text-[#7c677f] hover:text-[#8076a3]'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Right: CTA + theme toggle */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        <Link
          href="/calculator"
          className="hidden sm:inline-flex items-center px-5 py-2 rounded-full border-2 border-[#8076a3] text-[#8076a3] text-xs font-bold uppercase tracking-widest hover:bg-[#8076a3] hover:text-white transition-all"
        >
          Get Started
        </Link>
        <ThemeToggle />

        {/* Mobile hamburger */}
        <button
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--purple)] hover:text-[var(--green)] transition-colors"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="absolute top-[64px] left-0 right-0 bg-[var(--bg)] border-b border-[var(--border)] py-4 px-6 flex flex-col gap-1 md:hidden shadow-card"
        >
          {NAV_LINKS.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
                  active
                    ? 'text-[#9bc400] bg-[var(--surface-muted)]'
                    : 'text-[#7c677f] hover:text-[#8076a3] hover:bg-[var(--surface-muted)]'
                }`}
              >
                {label}
              </Link>
            );
          })}
          <Link href="/calculator" className="mt-2 px-5 py-2.5 rounded-full bg-[#9bc400] text-white text-sm font-bold uppercase tracking-wider text-center hover:bg-[#85a800] transition-colors">
            Get Started
          </Link>
        </nav>
      )}
    </header>
  );
}

