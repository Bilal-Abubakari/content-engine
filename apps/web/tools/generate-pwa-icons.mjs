// One-off generator for the PWA icon set. Run with `node tools/generate-pwa-icons.mjs`
// from apps/web. Uses next/og (already a dependency) so we don't add `sharp`.
// The emitted PNGs are committed as static assets, so there is zero runtime cost.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';

// next/og's ESM subpath export isn't resolvable by bare `node`, but its CJS
// entry is — load it through createRequire so this stays dependency-free.
const require = createRequire(import.meta.url);
const { ImageResponse } = require('next/og');

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'icons');

/** The brand mark: an indigo gradient rounded square with a bold "C" monogram. */
function icon(size, { maskable = false } = {}) {
  // Maskable icons must keep their glyph inside a ~80% safe zone so Android's
  // circular/rounded mask never clips it; plain icons can fill more of the tile.
  const pad = maskable ? Math.round(size * 0.14) : 0;
  const radius = maskable ? 0 : Math.round(size * 0.22);
  return React.createElement(
    'div',
    {
      style: {
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#4338ca',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          width: size - pad * 2,
          height: size - pad * 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius,
          backgroundImage:
            'linear-gradient(135deg, #818cf8 0%, #6366f1 45%, #4338ca 100%)',
        },
      },
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            fontSize: Math.round((size - pad * 2) * 0.6),
            fontWeight: 800,
            color: 'white',
            lineHeight: 1,
            letterSpacing: '-0.04em',
          },
        },
        'C',
      ),
    ),
  );
}

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-icon-180.png', size: 180 },
];

await mkdir(outDir, { recursive: true });

for (const { file, size, maskable } of targets) {
  const res = new ImageResponse(icon(size, { maskable }), {
    width: size,
    height: size,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(join(outDir, file), buf);
  console.log(`wrote ${file} (${size}x${size}, ${buf.length} bytes)`);
}

console.log('Done.');
