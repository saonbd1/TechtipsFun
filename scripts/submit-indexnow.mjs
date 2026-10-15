// Submit blog URLs to IndexNow (Bing, Yandex, Seznam, Naver, Yep).
//
// Usage:
//   node scripts/submit-indexnow.mjs <slug> [--dry-run]      submit one post
//   node scripts/submit-indexnow.mjs --latest [--dry-run]    submit newest post
//   node scripts/submit-indexnow.mjs --slugs a,b [--dry-run] submit several
//
// Requires:
//   INDEXNOW_KEY   8-128 hex chars; must match public/<key>.txt (key location:
//                    https://www.techtips.fun/<key>.txt). The workflow reads
//                    this from the INDEXNOW_KEY repo secret.
//
// Endpoints: api.indexnow.org (Bing) + yandex.com/indexnow. POST JSON:
//   { host, key, keyLocation, urlList }. 200/202 = accepted.
//
// NOTE: Google does NOT support IndexNow (Indexing API is JobPosting-only).
// Google discovery stays via sitemap (astro.config.mjs lastmod) + Search
// Console. This script is for Bing/Yandex-class engines.
//
// Manifest: .indexnow-submitted.json in repo root records submitted URLs so
// re-runs never resubmit (same pattern as .youtube-upload-manifest.json).
// Pre-seeded with the BitLocker URL (manually submitted to Google by owner).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'src', 'content', 'blog');
const manifestPath = path.join(root, '.indexnow-submitted.json');
const siteHost = 'www.techtips.fun';
const siteUrl = `https://${siteHost}`;

// URLs the owner already handled manually — never auto-submit these.
const SKIP_URLS = new Set([
  `${siteUrl}/blog/windows-11-bitlocker-settings-tips/`,
]);

function parseFrontmatter(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const raw = line.slice(sep + 1).trim();
    if (!raw) continue;
    if (raw.startsWith('"') && raw.endsWith('"')) {
      try { result[key] = JSON.parse(raw); } catch { result[key] = raw.slice(1, -1); }
    } else if (raw.startsWith("'") && raw.endsWith("'")) {
      result[key] = raw.slice(1, -1).replaceAll("''", "'");
    } else {
      result[key] = raw;
    }
  }
  return result;
}

const slugToUrl = (slug) => `${siteUrl}/blog/${slug}/`;

async function readPosts() {
  const files = (await fs.readdir(contentDir)).filter((f) => /\.(md|mdx)$/i.test(f));
  const posts = [];
  for (const file of files) {
    const fm = parseFrontmatter(await fs.readFile(path.join(contentDir, file), 'utf8'));
    posts.push({
      slug: file.replace(/\.(md|mdx)$/i, ''),
      title: fm.title ?? file,
      pubDate: fm.pubDate ? new Date(fm.pubDate) : new Date(0),
    });
  }
  return posts;
}

async function loadManifest() {
  try {
    return JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch { return {}; }
}

async function saveManifest(m) {
  await fs.writeFile(manifestPath, JSON.stringify(m, null, 2) + '\n');
}

async function submitBatch(urls, key, dryRun) {
  const host = siteHost;
  const keyLocation = `${siteUrl}/${key}.txt`;
  const endpoints = [
    'https://api.indexnow.org/indexnow',
    'https://yandex.com/indexnow',
  ];
  for (const endpoint of endpoints) {
    if (dryRun) {
      console.log(`[dry-run] POST ${endpoint} host=${host} urls=${urls.length}`);
      continue;
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation, urlList: urls }),
    });
    const body = await res.text();
    // 200 OK / 202 Accepted = received. 400/403/422 = caller error (bad key,
    // key file missing) — surface it. 429 = throttled, retry next run.
    console.log(`${endpoint} -> ${res.status} ${body.slice(0, 200)}`);
    if (![200, 202].includes(res.status)) {
      throw new Error(`IndexNow ${endpoint} rejected: ${res.status} ${body.slice(0, 300)}`);
    }
  }
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const wantLatest = args.includes('--latest');
const slugsIdx = args.indexOf('--slugs');
const slugsFlag = slugsIdx !== -1 ? args[slugsIdx + 1] : undefined;
let slugs = [];
if (slugsFlag) {
  slugs = slugsFlag.split(',').map((s) => s.trim()).filter(Boolean);
} else if (wantLatest) {
  const target = args.find((a) => a !== '--dry-run' && a !== '--slugs' && !a.startsWith('--'));
  const posts = await readPosts();
  if (args.includes('--latest')) {
    slugs = [posts.sort((a, b) => b.pubDate - a.pubDate)[0]?.slug].filter(Boolean);
  } else if (target) {
    if (!posts.some((p) => p.slug === target)) {
      console.error(`No post with slug "${target}" in src/content/blog/.`);
      process.exit(1);
    }
    slugs = [target];
  } else {
    console.error('Usage: node scripts/submit-indexnow.mjs <slug|--latest|--slugs a,b> [--dry-run]');
    process.exit(1);
  }
}

const key = process.env.INDEXNOW_KEY;
if (!key) {
  console.error('INDEXNOW_KEY environment variable is not set.');
  process.exit(1);
}

const manifest = await loadManifest();
const fresh = [];
for (const slug of slugs) {
  const url = slugToUrl(slug);
  if (SKIP_URLS.has(url)) {
    console.log(`skip (manually submitted by owner): ${url}`);
    continue;
  }
  if (manifest[url]) {
    console.log(`skip (already submitted ${manifest[url].submitted_at_utc}): ${url}`);
    continue;
  }
  fresh.push(url);
}
if (!fresh.length) {
  console.log('Nothing new to submit.');
  process.exit(0);
}

console.log(`Submitting ${fresh.length} URL(s):`);
for (const u of fresh) console.log(` - ${u}`);

await submitBatch(fresh, key, dryRun);

if (!dryRun) {
  const now = new Date().toISOString();
  for (const u of fresh) manifest[u] = { submitted_at_utc: now, via: 'indexnow' };
  await saveManifest(manifest);
  console.log(`Recorded ${fresh.length} URL(s) in .indexnow-submitted.json`);
}
