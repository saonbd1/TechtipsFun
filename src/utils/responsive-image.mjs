import fs from 'node:fs';
import path from 'node:path';

// Written by scripts/optimize-images.mjs. Missing in `astro dev` until that
// script has run once, in which case images fall back to their originals.
const manifestPath = path.resolve('src/generated/image-manifest.json');
let manifest;

function loadManifest() {
  if (manifest === undefined) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      manifest = {};
    }
  }
  return manifest;
}

/**
 * @param {string | undefined} src Public URL such as `/cover.png`.
 * @returns {{ src: string, srcset?: string, width?: number, height?: number }}
 */
export function getResponsiveImage(src) {
  if (!src) return { src: '' };
  const entry = loadManifest()[decodeURI(src.split(/[?#]/)[0])];
  if (!entry || entry.variants.length === 0) return { src };
  const largest = entry.variants.at(-1);
  return {
    src: largest.src,
    srcset: entry.variants.map((v) => `${v.src} ${v.width}w`).join(', '),
    width: entry.width,
    height: entry.height,
  };
}
