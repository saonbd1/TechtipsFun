/**
 * check-docs-duplication.mjs
 *
 * Guards against publishing the same content to both the Astro blog
 * (src/content/blog/) and the docs folder (docs/).
 *
 * Runs before pushing to GitBook. Exits non-zero if any overlap is found.
 */

import fs from "node:fs";
import path from "node:path";

const BLOG_DIR = "src/content/blog";
const DOCS_DIR = "docs";

function readFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const block = match[1];
  const fields = {};
  for (const line of block.split("\n")) {
    const [key, ...valueParts] = line.split(":");
    if (key && valueParts.length > 0) {
      fields[key.trim()] = valueParts.join(":").trim().replace(/^"|"$/g, "");
    }
  }
  return fields;
}

function slugFromFilename(fileName) {
  return path.basename(fileName, path.extname(fileName)).toLowerCase();
}

function listMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f));
}

const blogFiles = listMdFiles(BLOG_DIR);
const docsFiles = listMdFiles(DOCS_DIR);

const blogBySlug = new Map();
const blogByTitle = new Map();

for (const file of blogFiles) {
  const fm = readFrontmatter(file);
  const slug = slugFromFilename(file);
  blogBySlug.set(slug, file);
  if (fm.title) blogByTitle.set(fm.title.toLowerCase(), file);
}

let errors = 0;

console.log("🔍 Checking for blog ↔ docs duplication...\n");

for (const file of docsFiles) {
  const fm = readFrontmatter(file);
  const slug = slugFromFilename(file);
  const title = fm.title ? fm.title.toLowerCase() : "";

  // Check slug overlap
  if (blogBySlug.has(slug)) {
    console.error(
      `❌ SLUG CONFLICT: docs/${path.basename(file)}` +
        ` uses slug "${slug}" which already exists in blog: ${blogBySlug.get(slug)}`
    );
    errors++;
  }

  // Check title overlap
  if (title && blogByTitle.has(title)) {
    console.error(
      `❌ TITLE CONFLICT: docs/${path.basename(file)}` +
        ` uses title "${fm.title}" which already exists in blog: ${blogByTitle.get(title)}`
    );
    errors++;
  }
}

if (errors === 0) {
  console.log(`✅ Safe: ${docsFiles.length} doc(s), ${blogFiles.length} blog post(s), no overlaps.`);
  process.exit(0);
} else {
  console.error(`\n🛑 ${errors} duplication issue(s) found. Fix before publishing to GitBook.`);
  process.exit(1);
}
