#!/usr/bin/env node
/**
 * check-og-cards.mjs — every built post must have the social card its page asks for.
 *
 * src/pages/blog/[...slug].astro points `og:image` at `/og/<entry-id>.png`.
 * If the generated card is stored under any other name the image silently 404s
 * and the article shows no preview on LinkedIn / X / Slack / daily.dev.
 *
 * That is exactly what happened to two posts whose file names were not already
 * lowercase-hyphenated: `Simple-Ghostty-terminal-configuration-guide.md` and
 * `update-tpm- firmware-in-windows-11-guide (1).md` were served as
 * `/og/simple-ghostty-…png` and `/og/update-tpm--…-1.png` while
 * `generate-social-assets.mjs` wrote the raw file names (fixed 2026-10-15 by
 * routing every slug through src/utils/post-slug.mjs).
 *
 * The check compares the built /blog/<slug>/ directories (Astro's own idea of
 * the id, so it cannot drift from the page) against public/og/. Runs as the
 * last step of `npm run build` so a misnamed card fails the build instead of
 * shipping a broken preview.
 *
 * Usage: node scripts/check-og-cards.mjs [--json]
 * Exit code: 0 all cards present, 1 any missing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_BLOG = path.join(ROOT, 'dist', 'blog');
const OG_DIR = path.join(ROOT, 'public', 'og');

if (!fs.existsSync(DIST_BLOG)) {
  console.error(`No build output at ${path.relative(ROOT, DIST_BLOG)} — run \`npm run build\` first.`);
  process.exit(1);
}

/** Only directories with their own page are posts, not the pagination container. */
const slugs = fs
  .readdirSync(DIST_BLOG, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(DIST_BLOG, entry.name, 'index.html')))
  .map((entry) => entry.name);

const missing = slugs.filter((slug) => !fs.existsSync(path.join(OG_DIR, `${slug}.png`)));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ posts: slugs.length, missing }, null, 2));
} else if (missing.length) {
  console.error(`\n${missing.length} post(s) reference a social card that does not exist:\n`);
  for (const slug of missing) {
    console.error(`  /og/${slug}.png  <- requested by /blog/${slug}/`);
  }
  console.error(
    '\nFix: make sure the card is written under the post\'s entry id (src/utils/post-slug.mjs)\n' +
      'and that the file is committed in public/og/.\n',
  );
} else {
  console.log(`All ${slugs.length} posts have a social card in public/og/.`);
}

process.exit(missing.length ? 1 : 0);
