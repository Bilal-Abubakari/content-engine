const { join } = require('path');

// Absolute, POSIX-separated globs. Tailwind v3 resolves relative `content`
// entries against process.cwd() (the workspace root when Next runs), and its
// fast-glob scanner only matches forward slashes — so build an absolute path
// off __dirname and normalize the backslashes Windows' path.join produces.
const glob = (pattern) => join(__dirname, pattern).split('\\').join('/');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    glob('app/**/*.{ts,tsx,js,jsx}'),
    glob('components/**/*.{ts,tsx,js,jsx}'),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
      },
      keyframes: {
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.06)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
      animation: {
        'gradient-pan': 'gradient-pan 6s ease infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
