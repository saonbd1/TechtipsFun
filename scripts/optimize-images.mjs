// Generates resized WebP variants of every raster image in public/ so pages can
// serve a srcset instead of multi-megabyte originals. Originals are left untouched
// (their URLs keep working); variants go to public/_img/ (gitignored) and are
// described in src/generated/image-manifest.json for the templates and the
// rehype plugin to consume.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const outDir = path.join(publicDir, '_img');
const manifestPath = path.join(root, 'src', 'generated', 'image-manifest.json');

const rasterExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const skipDirs = new Set(['_img', 'og', 'fonts']);
const widths = [480, 960, 1600];
const quality = 78;

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) yield* walk(full);
    } else if (rasterExtensions.has(path.extname(entry.name).toLowerCase())) {
      yield full;
    }
  }
}

async function isFresh(target, sourceMtime) {
  try {
    return (await fs.stat(target)).mtimeMs >= sourceMtime;
  } catch {
    return false;
  }
}

function variantName(relPath, width) {
  const parsed = path.parse(relPath);
  const safeName = parsed.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
  return path.join(parsed.dir, `${safeName}-${width}w.webp`);
}

const manifest = {};
let generated = 0;

for await (const file of walk(publicDir)) {
  const relPath = path.relative(publicDir, file);
  const publicUrl = `/${relPath.split(path.sep).join('/')}`;
  try {
    const sourceMtime = (await fs.stat(file)).mtimeMs;
    const { width, height } = await sharp(file).metadata();
    if (!width || !height) continue;

    const targetWidths = widths.filter((w) => w < width);
    if (targetWidths.length < widths.length) targetWidths.push(Math.min(width, widths.at(-1)));

    const variants = [];
    for (const w of [...new Set(targetWidths)]) {
      const rel = variantName(relPath, w);
      const target = path.join(outDir, rel);
      if (!(await isFresh(target, sourceMtime))) {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await sharp(file).resize({ width: w, withoutEnlargement: true }).webp({ quality }).toFile(target);
        generated++;
      }
      variants.push({ width: w, src: `/_img/${rel.split(path.sep).join('/')}` });
    }
    manifest[publicUrl] = { width, height, variants };
  } catch (error) {
    console.warn(`Skipping ${publicUrl}: ${error.message}`);
  }
}

await fs.mkdir(path.dirname(manifestPath), { recursive: true });
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Optimized images: ${Object.keys(manifest).length} sources, ${generated} new variants in public/_img/.`);
