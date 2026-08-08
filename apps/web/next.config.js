//@ts-check

const { join } = require('path');

/**
 * Security headers applied to every response. Kept conservative so they don't
 * break Next's runtime: no strict CSP (Next injects inline/eval in dev), but
 * clickjacking, MIME-sniffing, referrer leakage and feature access are locked
 * down. HSTS is only meaningful over HTTPS and is ignored on plain HTTP.
 */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for a small production Docker image.
  output: 'standalone',
  // This app lives in an Nx monorepo, so file tracing must start at the
  // workspace root for the standalone bundle to pick up the hoisted
  // node_modules and the compiled `@org/database` client (../../ from here).
  outputFileTracingRoot: join(__dirname, '../../'),
  // The shared lib is consumed as TypeScript source, so Next must transpile it.
  transpilePackages: ['@org/shared'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
