#!/usr/bin/env node
/**
 * check-links.mjs — verify every link in the blog's markdown.
 *
 * External links: follows the redirect chain hop by hop (301/302/303/307/308)
 * and reports the status of each hop plus the final status, so redirect
 * "reasons" (http→https, www-normalisation, shorteners, locale hops…) are
 * visible instead of hidden behind a single final code.
 *
 * Requests mimic a real browser (User-Agent + Accept-Language). Without
 * these, several sites misbehave for datacenter clients: Google appends a
 * ?hl=<geo-locale> 302 hop when Accept-Language is absent, and WAFs
 * (e.g. www.w3.org) answer 403 to non-browser fingerprints even though
 * real readers get 200 — those are reported as `blocked`, not `broken`.
 *
 * Rate limits (429) and server timeouts (408) are reported as `rate_limited`:
 * the server refused this request, but the link itself is fine.
 *
 * Auth-walled links (Google Console, sign-in portals) either 302 to a
 * sign-in page or 302-loop to themselves; they are reported as
 * `login_wall` — expected for signed-in readers, never a broken link.
 *
 * Internal links: verifies /blog/<slug>/ links resolve to a real post file
 * and warns when the trailing slash is missing (the Worker answers those
 * with a 307 — the class of bug fixed on 2026-10-04).
 *
 * Usage:
 *   node scripts/check-links.mjs [files-or-dirs...] [options]
 *   npm run check:links
 *
 * Options:
 *   --fail-on=dead|redirect|all|none  what makes the exit code non-zero
 *                                      dead     = unreachable (DNS/timeout/TLS) or 404/410 (default)
 *                                      redirect = also fail on any 3xx redirect chain
 *                                      all      = also fail on blocked + rate_limited + login_wall
 *                                      none     = report only
 *   --timeout=ms      per-request timeout (default 15000)
 *   --max-redirects=n max hops followed (default 10)
 *   --concurrency=n   parallel requests (default 8)
 *   --retries=n       retries on transient network errors (default 1)
 *   --json            machine-readable report on stdout
 *
 * Exit code: 0 clean, 1 when the chosen fail level is hit.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postSlug } from '../src/utils/post-slug.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};
const flags = {
  json: args.includes('--json'),
  failOn: opt('fail-on', 'dead'),
  timeout: Number(opt('timeout', '15000')),
  maxRedirects: Number(opt('max-redirects', '10')),
  concurrency: Number(opt('concurrency', '8')),
  retries: Number(opt('retries', '1')),
};

const targets = args.filter((a) => !a.startsWith('--'));
const scanRoots = targets.length
  ? targets.map((t) => path.resolve(ROOT, t))
  : [path.join(ROOT, 'src/content/blog'), path.join(ROOT, 'pending-posts')];

function collectMd(dirOrFile, out = []) {
  if (!fs.existsSync(dirOrFile)) return out;
  const stat = fs.statSync(dirOrFile);
  if (stat.isFile()) {
    if (dirOrFile.endsWith('.md')) out.push(dirOrFile);
    return out;
  }
  for (const ent of fs.readdirSync(dirOrFile, { withFileTypes: true })) {
    collectMd(path.join(dirOrFile, ent.name), out);
  }
  return out;
}
const mdFiles = scanRoots.flatMap((r) => collectMd(r));

const mdLinkRe = /\[[^\]]*\]\(([^)\s]+)\)/g;

/** Extract every link target from one markdown file. */
function extractLinks(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  // Strip fenced code blocks — links in examples (e.g. image-syntax
  // demos) are not real links and would poison the report.
  const text = raw.replace(/```[\s\S]*?```/g, '');
  const external = new Map(); // url -> { firstSeen }
  const internal = []; // { raw, file, line }
  let m;
  let line = 1;
  let lastIdx = 0;
  while ((m = mdLinkRe.exec(text))) {
    line += text.slice(lastIdx, m.index).split('\n').length - 1;
    lastIdx = m.index;
    const clean = m[1].split('#')[0];
    if (/^https?:\/\//i.test(clean)) {
      const key = clean;
      if (!external.has(key)) external.set(key, { firstSeen: `${rel}:${line}` });
    } else if (clean.startsWith('/') || (!clean.startsWith('mailto:') && !clean.startsWith('data:'))) {
      internal.push({ raw: clean, file: rel, line });
    }
  }
  return { external, internal };
}

/**
 * Every post slug the site actually serves. Astro derives the entry id from the
 * file name (lowercased, spaces -> dashes), so comparing a URL slug against the
 * raw file name produced false "post file missing" reports for
 * `Simple-Ghostty-terminal-configuration-guide.md` and the like. Normalise both
 * sides through the same helper the build scripts use.
 */
const postSlugs = new Set(
  fs
    .readdirSync(path.join(ROOT, 'src/content/blog'))
    .filter((file) => /\.(md|mdx)$/i.test(file))
    .map((file) => postSlug(file)),
);

const externalAll = new Map();
const internalAll = [];
for (const f of mdFiles) {
  const { external, internal } = extractLinks(f);
  for (const [url, meta] of external) {
    if (!externalAll.has(url)) externalAll.set(url, meta);
  }
  internalAll.push(...internal);
}
const externalUrls = [...externalAll.keys()];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Follow one URL hop by hop, recording every status + redirect target. */
async function fetchOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), flags.timeout);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': UA,
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timer);
    res.body?.cancel?.().catch?.(() => {});
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/** Hosts / paths that mean "you must sign in first" (an auth wall, not a broken link). */
const SIGNIN_HOSTS = ['accounts.google.com', 'login.microsoftonline.com', 'login.live.com'];
const SIGNIN_PATH_RE = /\/(ServiceLogin|signin|oauth2.*login)/i;

function isSigninRedirect(fromUrl, loc) {
  try {
    const u = new URL(loc, fromUrl);
    if (SIGNIN_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) return true;
    if (SIGNIN_PATH_RE.test(u.pathname + u.search)) return true;
  } catch {
    /* unparseable — not a sign-in signal */
  }
  return false;
}

async function checkExternal(url) {
  const hops = [];
  let current = url;
  for (let i = 0; i <= flags.maxRedirects; i++) {
    let res;
    let lastErr;
    for (let attempt = 0; attempt <= flags.retries; attempt++) {
      try {
        res = await fetchOnce(current);
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < flags.retries) await new Promise((r) => setTimeout(r, 1000));
      }
    }
    if (!res) {
      const cause = lastErr.cause?.code || lastErr.cause?.message || lastErr.message || 'unknown';
      return { url, hops, final: 0, error: lastErr.name === 'AbortError' ? 'timeout' : cause };
    }
    const hop = { status: res.status, url: current };
    if (res.status >= 300 && res.status < 400) hop.location = res.headers.get('location');
    hops.push(hop);
    if (res.status >= 300 && res.status < 400 && i < flags.maxRedirects) {
      const loc = res.headers.get('location');
      if (!loc) return { url, hops, final: 0, error: 'redirect_without_location' };
      let next;
      try {
        next = new URL(loc, current).href;
      } catch {
        return { url, hops, final: 0, error: 'unparseable_redirect' };
      }
      // Auth walls: a 302 to a sign-in page, or a 302 straight back to
      // itself (Google Console's unauthenticated bounce), are expected.
      const selfLoop = next.replace(/\/+$/, '') === current.replace(/\/+$/, '');
      if (selfLoop || isSigninRedirect(current, loc)) {
        return { url, hops, final: res.status, loginWall: true };
      }
      current = next;
      continue;
    }
    return { url, hops, final: res.status };
  }
  return { url, hops, final: 999, error: 'too_many_redirects' };
}

/** Validate an internal link against the repo's real files. */
function checkInternal(link) {
  const problems = [];
  let target;
  try {
    target = link.raw.startsWith('/')
      ? link.raw
      : path.resolve(path.dirname(path.join(ROOT, link.file)), link.raw);
  } catch {
    return { ...link, problems: ['unparseable'] };
  }
  const p = target.split('#')[0];
  const blogMatch = p.match(/^\/blog\/([^/]+)\/?$/);
  if (blogMatch) {
    if (!postSlugs.has(postSlug(blogMatch[1]))) problems.push('post file missing');
    if (!link.raw.endsWith('/')) problems.push('missing trailing slash (Worker answers with 307)');
    return { ...link, problems };
  }
  if (p.startsWith('/')) {
    const asset = path.join(ROOT, 'public', p);
    if (!fs.existsSync(asset)) problems.push('asset not in public/ (may be build-generated)');
    return { ...link, problems };
  }
  if (!fs.existsSync(target)) problems.push('relative target missing');
  return { ...link, problems };
}

async function main() {
  const results = [];
  const queue = [...externalUrls];
  const workers = Array.from({ length: flags.concurrency }, async () => {
    while (queue.length) {
      const url = queue.shift();
      const r = await checkExternal(url);
      results.push({ ...r, firstSeen: externalAll.get(url)?.firstSeen });
    }
  });
  await Promise.all(workers);

  const internalResults = internalAll.map(checkInternal);

  for (const r of results) {
    r.redirects = r.hops.filter((h) => h.status >= 300 && h.status < 400).length;
    if (r.loginWall) r.severity = 'login_wall';
    else if (r.final === 0) r.severity = 'dead';
    else if (r.final === 404 || r.final === 410) r.severity = 'broken';
    else if (r.final === 401 || r.final === 403) r.severity = 'blocked';
    // 429 Too Many Requests / 408 Request Timeout mean the server refused
    // *this request* - usually a rate limit aimed at the runner's datacenter
    // IP - not that the link is gone. Treating 429 as `broken` made live links
    // fail the build: Google answers 429 to GitHub's runners for blogspot URLs
    // that return 200 to everyone else.
    else if (r.final === 429 || r.final === 408) r.severity = 'rate_limited';
    else if (r.final >= 400 && r.final < 500) r.severity = 'broken';
    else if (r.final >= 500) r.severity = 'server_error';
    else if (r.final >= 300) r.severity = 'redirect_loop';
    else if (r.redirects > 0) r.severity = 'redirect';
    else r.severity = 'ok';
  }

  const counts = { ok: 0, redirect: 0, login_wall: 0, blocked: 0, rate_limited: 0, dead: 0, broken: 0, server_error: 0, redirect_loop: 0 };
  for (const r of results) counts[r.severity] = (counts[r.severity] || 0) + 1;
  const internalProblems = internalResults.filter((r) => r.problems.length);

  if (flags.json) {
    process.stdout.write(
      JSON.stringify({ counts, external: results, internal: internalResults }, null, 2)
    );
  } else {
    console.log(`\nScanned ${mdFiles.length} markdown files — ${externalUrls.length} unique external links, ${internalAll.length} internal links.\n`);
    const order = { dead: 0, broken: 0, redirect_loop: 0, server_error: 0, blocked: 1, rate_limited: 1, login_wall: 2, redirect: 3, ok: 4 };
    const sorted = [...results].sort((a, b) => order[a.severity] - order[b.severity]);
    for (const r of sorted) {
      if (r.severity === 'ok' && r.redirects === 0) continue;
      const chain = r.hops.map((h) => `${h.status}${h.location ? `→${h.location}` : ''}`).join('  ');
      const why = r.error ? ` (${r.error})` : '';
      console.log(`[${r.severity.toUpperCase()}] ${r.url}`);
      console.log(`   hops: ${chain}${why}   first seen: ${r.firstSeen}`);
    }
    if (internalProblems.length) {
      console.log('\nInternal link problems:');
      for (const p of internalResults.filter((x) => x.problems.length)) {
        console.log(`[INTERNAL] ${p.raw}  (${p.file}:${p.line})  ${p.problems.join(', ')}`);
      }
    }
    console.log(`\nTotals: ok=${counts.ok} redirect=${counts.redirect} login_wall=${counts.login_wall} blocked=${counts.blocked} rate_limited=${counts.rate_limited} dead=${counts.dead} broken=${counts.broken} server_error=${counts.server_error} redirect_loop=${counts.redirect_loop} internal_problems=${internalProblems.length}`);
  }

  const failLevels = {
    dead: ['dead', 'broken'],
    redirect: ['dead', 'broken', 'redirect', 'redirect_loop'],
    all: ['dead', 'broken', 'redirect', 'redirect_loop', 'blocked', 'rate_limited', 'login_wall'],
  };
  const failing = failLevels[flags.failOn] || failLevels.dead;
  if (results.some((r) => failing.includes(r.severity))) process.exit(1);
}

main();

