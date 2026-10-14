/**
 * Finds the images and screenshots an article already uses (the `heroImage`
 * plus any `![alt](src)` / `<img>` inside each `##` section) and stages them
 * for Remotion.
 *
 * Remotion can only load local assets from `reels/public/` (via staticFile), so
 * every image is copied to `reels/public/post-media/<slug>/`, downscaled to at
 * most 1600px and re-encoded as WebP. That keeps renders fast and avoids odd
 * file names (spaces, unicode) in URLs. The folder is gitignored and rebuilt on
 * every props build.
 *
 * Nothing here is required: a post without images still gets a text-only reel,
 * and an image that cannot be found or decoded is skipped with a warning.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REELS_ROOT = path.resolve(HERE, "..", "..");
const SITE_PUBLIC_DIR = path.resolve(REELS_ROOT, "..", "public");
const MEDIA_DIR = path.join(REELS_ROOT, "public", "post-media");

const MAX_EDGE = 1600;
// Icons, badges and tracking pixels are not worth a scene.
const MIN_EDGE = 320;
const FETCH_TIMEOUT_MS = 10_000;

// Template leftovers and generic stock placeholders.
const IGNORED = [/blog-placeholder/i, /full\/or\/relative\/path/i, /^data:/i];

const safeName = (value) =>
  value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "image";

const readSource = async (src, articleDir) => {
  if (/^https?:\/\//i.test(src)) {
    const response = await fetch(src, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { buffer: Buffer.from(await response.arrayBuffer()), key: src };
  }

  const clean = decodeURIComponent(src.split(/[?#]/)[0]);
  const file = clean.startsWith("/")
    ? path.join(SITE_PUBLIC_DIR, clean)
    : path.resolve(articleDir, clean);
  return { buffer: await fs.readFile(file), key: file };
};

/**
 * @returns {Promise<{
 *   hero: {src:string,width:number,height:number}|null,
 *   sections: Map<object, {src:string,width:number,height:number,alt:string}>,
 *   count: number,
 * }>}
 */
export const collectPostMedia = async ({
  slug,
  heroImage,
  sections,
  articleDir,
}) => {
  const outDir = path.join(MEDIA_DIR, slug);
  await fs.rm(outDir, { recursive: true, force: true });

  const seen = new Set();
  let index = 0;

  const stage = async (src, alt = "", { trim = true } = {}) => {
    if (!src || IGNORED.some((pattern) => pattern.test(src))) return null;
    try {
      const { buffer, key } = await readSource(src, articleDir);
      if (seen.has(key)) return null;
      seen.add(key);

      // In-article screenshots often carry wide flat margins around the useful part;
      // trimming them lets the content fill the card. Falls back to the
      // untouched image if trimming fails (e.g. a single flat colour).
      let input = await sharp(buffer, { animated: false }).rotate().toBuffer();
      if (trim) {
        try {
          const trimmed = await sharp(input).trim({ threshold: 12 }).toBuffer();
          const t = await sharp(trimmed).metadata();
          if (t.width >= MIN_EDGE * 0.5 && t.height >= MIN_EDGE * 0.5) {
            input = trimmed;
          }
        } catch {
          /* keep the original */
        }
      }

      const image = sharp(input);
      const meta = await image.metadata();
      if (!meta.width || !meta.height) return null;
      if (Math.max(meta.width, meta.height) < MIN_EDGE) return null;

      await fs.mkdir(outDir, { recursive: true });
      index += 1;
      const fileName = `${String(index).padStart(2, "0")}-${safeName(path.basename(src))}.webp`;
      const { width, height } = await image
        .resize({
          width: MAX_EDGE,
          height: MAX_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 88 })
        .toFile(path.join(outDir, fileName));

      return { src: `post-media/${slug}/${fileName}`, width, height, alt };
    } catch (error) {
      console.warn(`  ! ${slug}: skipped image ${src} (${error.message})`);
      return null;
    }
  };

  // Covers are designed artwork - never trim them.
  const hero = await stage(heroImage, "", { trim: false });

  const bySection = new Map();
  for (const section of sections) {
    if (!section.heading) {
      // Intro images are almost always the hero again (the title scene
      // already shows that one).
      continue;
    }
    for (const image of section.images ?? []) {
      const staged = await stage(image.src, image.alt);
      if (staged) {
        bySection.set(section, staged);
        break; // one screenshot per scene
      }
    }
  }

  return {
    hero: hero ? { src: hero.src, width: hero.width, height: hero.height } : null,
    sections: bySection,
    count: (hero ? 1 : 0) + bySection.size,
  };
};
