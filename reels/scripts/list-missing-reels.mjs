#!/usr/bin/env node
/**
 * Decides which articles the "Generate article reels" workflow should render.
 *
 *   1. MISSING  - articles with no reel yet (newest first). Always first, so a
 *                 freshly published post never waits behind a backfill.
 *   2. OUTDATED - reels rendered by an older pipeline (REEL_VERSION in
 *                 build-reel-props.mjs), newest first, capped by --refresh.
 *                 This is how existing reels pick up a redesign gradually
 *                 (e.g. 2 per day from the daily schedule).
 *
 * Which version each reel was rendered with is tracked in
 * article-reels/.reel-versions.json. Reels not listed there count as version 1.
 *
 * Usage:
 *   node scripts/list-missing-reels.mjs [--limit N] [--refresh N] [--slug <slug>] [--force]
 *   node scripts/list-missing-reels.mjs --mark <slug>    # record a finished render
 *   node scripts/list-missing-reels.mjs --status         # counts only
 *
 * Slugs go to stdout (one per line); the summary goes to stderr so it can be
 * captured with $(...). The approach (scan, not commit diff) is idempotent and
 * self-healing after a failed render, and works no matter how the post got
 * published (see the workflow for why the push *event* alone is not enough).
 */

import fs from "node:fs";
import path from "node:path";
import { REELS_ROOT } from "./lib/remotion-cli.mjs";
import {
  REEL_VERSION,
  listArticles,
  readArticle,
} from "./build-reel-props.mjs";

const REPO_ROOT = path.resolve(REELS_ROOT, "..");
const REELS_OUT_DIR = path.join(REPO_ROOT, "article-reels");
const VERSIONS_FILE = path.join(REELS_OUT_DIR, ".reel-versions.json");

const parseArgs = (argv) => {
  const args = { limit: Infinity, refresh: 0, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--limit") args.limit = Number(argv[++index]) || Infinity;
    else if (arg === "--refresh") args.refresh = Math.max(0, Number(argv[++index]) || 0);
    else if (arg === "--slug") args.slug = argv[++index];
    else if (arg === "--mark") args.mark = argv[++index];
    else if (arg === "--force") args.force = true;
    else if (arg === "--status") args.status = true;
  }
  return args;
};

const reelPath = (slug) => path.join(REELS_OUT_DIR, `${slug}.mp4`);

const readVersions = () => {
  try {
    return JSON.parse(fs.readFileSync(VERSIONS_FILE, "utf8"));
  } catch {
    return {};
  }
};

const writeVersions = (versions) => {
  const sorted = Object.fromEntries(
    Object.entries(versions).sort(([a], [b]) => a.localeCompare(b)),
  );
  fs.mkdirSync(REELS_OUT_DIR, { recursive: true });
  fs.writeFileSync(VERSIONS_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
};

const versionOf = (versions, slug) => Number(versions[slug]) || 1;

const publishedAt = (frontmatter) =>
  Date.parse(frontmatter.pubDate ?? "") || 0;

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const versions = readVersions();

  if (args.mark) {
    versions[args.mark] = REEL_VERSION;
    writeVersions(versions);
    console.error(`${args.mark}: marked as reel version ${REEL_VERSION}`);
    return;
  }

  if (args.slug) {
    if (!args.force && fs.existsSync(reelPath(args.slug))) {
      console.error(`${args.slug}: reel already exists (use --force to redo).`);
      return;
    }
    process.stdout.write(`${args.slug}\n`);
    return;
  }

  const missing = [];
  const outdated = [];
  for (const slug of await listArticles()) {
    const exists = fs.existsSync(reelPath(slug));
    const stale = exists && versionOf(versions, slug) < REEL_VERSION;
    if (exists && !stale && !args.force) continue;

    const { frontmatter } = await readArticle(slug);
    const entry = { slug, published: publishedAt(frontmatter) };
    if (!exists || args.force) missing.push(entry);
    else outdated.push(entry);
  }

  // Newest first, so a freshly published post always wins a limited slot.
  const newestFirst = (a, b) => b.published - a.published;
  missing.sort(newestFirst);
  outdated.sort(newestFirst);

  if (args.status) {
    console.log(
      `reel version ${REEL_VERSION}: ${missing.length} missing, ${outdated.length} outdated`,
    );
    return;
  }

  const selected = [
    ...missing.slice(0, args.limit),
    ...outdated.slice(0, args.refresh),
  ];
  for (const entry of selected) {
    process.stdout.write(`${entry.slug}\n`);
  }

  const missingTaken = Math.min(missing.length, args.limit);
  const outdatedTaken = Math.min(outdated.length, args.refresh);
  console.error(
    `missing reels: ${missing.length} (rendering ${missingTaken}); ` +
      `outdated reels: ${outdated.length} (refreshing ${outdatedTaken}); ` +
      `current version: ${REEL_VERSION}; output dir: article-reels/`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
