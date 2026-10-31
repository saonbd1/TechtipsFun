#!/usr/bin/env node
/**
 * Generate data/read-queue.json from all blog posts in src/content/blog/.
 * Extracts title, description, and builds the techtips.fun URL for each.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, "src", "content", "blog");
const OUT_PATH = path.join(ROOT, "data", "read-queue.json");

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
      url: "https://www.techtips.fun/blog/" + slug + "/",
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
