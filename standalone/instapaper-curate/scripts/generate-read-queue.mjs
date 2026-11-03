#!/usr/bin/env node
/**
 * Generate data/read-queue.json from a folder of Markdown/MDX blog posts.
 * Extracts title, description, and builds the post URL for each.
 *
 * Usage:
 *   node scripts/generate-read-queue.mjs [--blog <dir>] [--base <url>] [--out <file>]
 *
 *   --blog  folder holding the .md/.mdx posts   (default: src/content/blog)
 *   --base  URL the posts live under           (default: https://www.techtips.fun/blog)
 *   --out   output file                        (default: data/read-queue.json)
 *
 * Point --blog at your blog repo's content folder to rebuild the queue, e.g.
 *   node scripts/generate-read-queue.mjs --blog ../TechtipsFun/src/content/blog
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

/** Read `--flag value` from argv, falling back to a default. */
function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BLOG_DIR = path.resolve(arg("--blog", path.join(ROOT, "src", "content", "blog")));
const BASE_URL = arg("--base", "https://www.techtips.fun/blog").replace(/\/+$/, "");
const OUT_PATH = path.resolve(arg("--out", path.join(ROOT, "data", "read-queue.json")));

if (!fs.existsSync(BLOG_DIR)) {
  console.error(`Blog folder not found: ${BLOG_DIR}`);
  console.error("Pass it explicitly: --blog <dir>");
  process.exit(1);
}

const files = fs.readdirSync(BLOG_DIR).filter((f) => /\.mdx?$/.test(f));
const results = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(BLOG_DIR, file), "utf8");
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) continue;
  const fm = match[1];
  const title = fm.match(/^title:\s*["']?(.*?)["']?\s*$/m)?.[1]?.trim();
  const desc = fm.match(/^description:\s*["']?(.*?)["']?\s*$/m)?.[1]?.trim();
  const slug = file.replace(/\.mdx?$/, "");
  if (title && desc) {
    results.push({
      url: `${BASE_URL}/${slug}`,
      title: title,
      description: desc,
    });
  }
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2) + "\n");

console.log(`Wrote ${results.length} entries to ${OUT_PATH}`);
for (const r of results) {
  console.log(`  - ${r.title}`);
}
