import type { MetadataRoute } from 'next';

/**
 * The web app manifest that makes ContentEngine installable as a PWA. Served at
 * /manifest.webmanifest by Next's metadata route convention. `start_url` opens
 * straight into the dashboard so a launched app skips the marketing site, and
 * the icon set includes a maskable variant for Android adaptive icons.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ContentEngine',
    short_name: 'ContentEngine',
    description:
      'Repurpose one link into a week of content and manage every reply from a unified social inbox.',
    id: '/',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b1120',
    theme_color: '#6366f1',
    categories: ['productivity', 'business', 'social'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
