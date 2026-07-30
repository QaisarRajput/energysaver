/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        green: { DEFAULT: '#9bc400', hover: '#85a800' },
        purple: { DEFAULT: '#8076a3', dark: '#7c677f' },
        pink: { DEFAULT: '#f9c5bd' },
        accent: { DEFAULT: '#9bc400', dark: '#9bc400' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
        display: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        black: '900',
      },
      letterSpacing: {
        display: '-0.03em',
        wide2: '0.12em',
      },
      borderRadius: {
        pill: '9999px',
      },
      boxShadow: {
        card: '0 2px 16px rgba(128,118,163,0.08)',
        'card-hover': '0 4px 24px rgba(128,118,163,0.14)',
        green: '0 4px 20px rgba(155,196,0,0.25)',
      },
    },
  },
  plugins: [],
};

