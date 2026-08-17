// One-off generator for the PWA icon set. Run with `node tools/generate-pwa-icons.mjs`
// from apps/web. Uses next/og (already a dependency) so we don't add `sharp`.
// The emitted PNGs are committed as static assets, so there is zero runtime cost.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';

// next/og's ESM subpath export isn't resolvable by bare `node`, but its CJS
// entry is — load it through createRequire so this stays dependency-free.
const require = createRequire(import.meta.url);
const { ImageResponse } = require('next/og');

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, '..', 'public', 'icons');
const appDir = join(here, '..', 'app');
const logoPath = join(here, '..', 'assets', 'images', 'logo.jpeg');

// Inline the source logo so ImageResponse can rasterize it without a network
// fetch. The art already carries its own white margin, so we composite it on a
// white tile and only add extra padding for the maskable safe zone.
const logoDataUri = `data:image/jpeg;base64,${(await readFile(logoPath)).toString('base64')}`;

/** The brand logo centered on a white tile, sized for a given icon target. */
function icon(size, { maskable = false } = {}) {
  // Maskable icons must keep their glyph inside a ~80% safe zone so Android's
  // circular/rounded mask never clips it; plain icons can sit closer to the edge.
  const pad = Math.round(size * (maskable ? 0.16 : 0.06));
  return React.createElement(
    'div',
    {
      style: {
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
      },
    },
    React.createElement('img', {
      src: logoDataUri,
      width: size - pad * 2,
      height: size - pad * 2,
      style: { objectFit: 'contain' },
    }),
  );
}

const targets = [
  { dir: iconsDir, file: 'icon-192.png', size: 192 },
  { dir: iconsDir, file: 'icon-512.png', size: 512 },
  { dir: iconsDir, file: 'icon-maskable-512.png', size: 512, maskable: true },
  { dir: iconsDir, file: 'apple-icon-180.png', size: 180 },
  // Browser-tab favicon (Next serves app/icon.png on the <link rel="icon">).
  { dir: appDir, file: 'icon.png', size: 256 },
];

await mkdir(iconsDir, { recursive: true });

for (const { dir, file, size, maskable } of targets) {
  const res = new ImageResponse(icon(size, { maskable }), {
    width: size,
    height: size,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(join(dir, file), buf);
  console.log(`wrote ${file} (${size}x${size}, ${buf.length} bytes)`);
}

console.log('Done.');
