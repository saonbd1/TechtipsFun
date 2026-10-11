import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const contentDir = path.join(root, 'src', 'content', 'blog');
const socialDir = path.join(publicDir, 'og');

const rasterExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const fontFamily = 'Arial, Helvetica, sans-serif';
const colors = {
  background: '#101214',
  grid: '#262a2b',
  white: '#f7f8f6',
  muted: '#919594',
  lime: '#b6ff2b',
};

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function parseFrontmatter(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    if (!raw) continue;
    if (raw.startsWith('"') && raw.endsWith('"')) {
      try {
        result[key] = JSON.parse(raw);
      } catch {
        result[key] = raw.slice(1, -1);
      }
    } else if (raw.startsWith("'") && raw.endsWith("'")) {
      result[key] = raw.slice(1, -1).replaceAll("''", "'");
    } else {
      result[key] = raw;
    }
  }
  return result;
}

function wrapTitle(title, maxChars) {
  const words = String(title).trim().split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function imageDataUri(buffer, mime = 'image/png') {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

async function optimizeRaster(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!rasterExtensions.has(extension)) return null;

  const original = await fs.stat(filePath);
  const image = sharp(filePath, { failOn: 'none' });
  let pipeline = image;
  if (extension === '.jpg' || extension === '.jpeg') {
    pipeline = pipeline.jpeg({ quality: 82, progressive: true, mozjpeg: true });
  } else if (extension === '.webp') {
    pipeline = pipeline.webp({ quality: 82, effort: 6 });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  }

  const tempPath = `${filePath}.optimized`;
  await pipeline.toFile(tempPath);
  const optimized = await fs.stat(tempPath);
  if (optimized.size < original.size) {
    await fs.rename(tempPath, filePath);
    return { filePath, before: original.size, after: optimized.size };
  }
  await fs.rm(tempPath, { force: true });
  return { filePath, before: original.size, after: original.size };
}

async function loadHeroImage(heroImage) {
  const fallback = path.join(publicDir, 'blog-placeholder-1.webp');
  const requested = typeof heroImage === 'string' && heroImage.startsWith('/')
    ? path.join(publicDir, heroImage.slice(1))
    : fallback;
  try {
    await fs.access(requested);
    return requested;
  } catch {
    return fallback;
  }
}

function buildCardSvg({ title, featuredImageUri, authorImageUri }) {
  const lines = wrapTitle(title, title.length > 72 ? 28 : 25);
  const titleFontSize = lines.length >= 4 ? 38 : lines.length === 3 ? 44 : 52;
  const lineHeight = titleFontSize + 17;
  const titleStartY = 146;
  const titleSvg = lines
    .slice(0, 4)
    .map((line, index) => `<text x="66" y="${titleStartY + index * lineHeight}" fill="${colors.white}" font-family="${fontFamily}" font-size="${titleFontSize}" font-weight="700">${escapeXml(line)}</text>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <clipPath id="postImageClip"><circle cx="1023" cy="330" r="165" /></clipPath>
    <clipPath id="authorImageClip"><circle cx="105" cy="528" r="38" /></clipPath>
    <linearGradient id="accentFade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${colors.lime}"/><stop offset="1" stop-color="${colors.lime}" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="${colors.background}"/>
  <g stroke="${colors.grid}" stroke-width="1" opacity="0.8">
    <path d="M0 90H1200 M0 180H1200 M0 270H1200 M0 360H1200 M0 450H1200 M0 540H1200"/>
    <path d="M100 0V630 M200 0V630 M300 0V630 M400 0V630 M500 0V630 M600 0V630 M700 0V630 M800 0V630 M900 0V630 M1000 0V630 M1100 0V630"/>
  </g>
  <path d="M963 -22 C1040 102 1150 198 1095 338 C1050 451 1020 532 967 658" fill="none" stroke="${colors.lime}" stroke-width="3"/>
  <path d="M860 153 C930 95 1035 108 1113 162" fill="none" stroke="#4d6847" stroke-width="1" opacity="0.8"/>
  <rect x="66" y="38" width="205" height="40" rx="20" fill="${colors.lime}"/>
  <text x="88" y="65" fill="#0a0c0c" font-family="${fontFamily}" font-size="20" font-weight="700" letter-spacing="0.3">TECHTIPS.FUN</text>
  <circle cx="1123" cy="69" r="27" fill="none" stroke="${colors.lime}" stroke-width="2"/>
  <text x="1107" y="76" fill="${colors.lime}" font-family="${fontFamily}" font-size="17" font-weight="700">SB</text>
  ${titleSvg}
  <line x1="66" y1="465" x2="506" y2="465" stroke="url(#accentFade)" stroke-width="3"/>
  <circle cx="105" cy="528" r="38" fill="${colors.background}"/>
  <image href="${authorImageUri}" x="67" y="490" width="76" height="76" preserveAspectRatio="xMidYMid slice" clip-path="url(#authorImageClip)"/>
  <circle cx="105" cy="528" r="42" fill="none" stroke="${colors.lime}" stroke-width="3"/>
  <text x="171" y="526" fill="${colors.white}" font-family="${fontFamily}" font-size="30" font-weight="700">SaonBD</text>
  <text x="171" y="569" fill="${colors.muted}" font-family="${fontFamily}" font-size="18">SEO · AI · Open source · Web3</text>
  <image href="${featuredImageUri}" x="858" y="165" width="330" height="330" preserveAspectRatio="xMidYMid slice" clip-path="url(#postImageClip)"/>
  <circle cx="1023" cy="330" r="175" fill="none" stroke="${colors.lime}" stroke-width="3"/>
  <circle cx="1023" cy="330" r="195" fill="none" stroke="#486144" stroke-width="1" opacity="0.85"/>
  <path d="M825 192h22 M825 250h22 M825 308h22 M825 366h22" stroke="#486144" stroke-width="1"/>
</svg>`;
}

async function generateSocialCards(posts) {
  await fs.rm(socialDir, { recursive: true, force: true });
  await fs.mkdir(socialDir, { recursive: true });

  const authorPath = path.join(publicDir, 'portrait.webp');
  const authorBuffer = await sharp(authorPath).resize(76, 76, { fit: 'cover' }).png().toBuffer();
  const authorImageUri = imageDataUri(authorBuffer);

  for (const post of posts) {
    const heroPath = await loadHeroImage(post.heroImage);
    const featuredBuffer = await sharp(heroPath).resize(330, 330, { fit: 'cover', position: 'attention' }).png().toBuffer();
    const featuredImageUri = imageDataUri(featuredBuffer);
    const svg = buildCardSvg({
      title: post.title || 'TechTips.fun',
      featuredImageUri,
      authorImageUri,
    });
    const outputPath = path.join(socialDir, `${post.slug}.png`);
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outputPath);
  }
}

async function readPosts() {
  const files = (await walk(contentDir)).filter((file) => /\.(md|mdx)$/i.test(file));
  const posts = [];
  for (const file of files) {
    const frontmatter = parseFrontmatter(await fs.readFile(file, 'utf8'));
    posts.push({
      slug: path.basename(file).replace(/\.(md|mdx)$/i, ''),
      title: frontmatter.title,
      heroImage: frontmatter.heroImage,
    });
  }
  return posts;
}

const publicFiles = await walk(publicDir);
const generatedDir = path.join(publicDir, '_img');
const sourceImages = publicFiles.filter(
  (file) => !file.startsWith(`${socialDir}${path.sep}`) && !file.startsWith(`${generatedDir}${path.sep}`),
);
const results = [];
for (const file of sourceImages) {
  const result = await optimizeRaster(file);
  if (result) results.push(result);
}

const posts = await readPosts();
await generateSocialCards(posts);

const savedBytes = results.reduce((sum, result) => sum + (result.before - result.after), 0);
console.log(`Optimized ${results.length} raster assets; saved ${savedBytes} bytes.`);
console.log(`Generated ${posts.length} post-specific social cards in public/og/.`);
