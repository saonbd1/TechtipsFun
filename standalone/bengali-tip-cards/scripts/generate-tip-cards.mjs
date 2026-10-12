#!/usr/bin/env node
/**
 * generate-tip-cards.mjs — social-media "photo cards" built from CSV rows.
 *
 * Text comes from CSV rows (columns: category, title, tip) — typically the
 * output of scripts/clean_text_to_csv.py — and the card is rendered as SVG and
 * rasterised with sharp. Derived from the OG image generator used on
 * techtips.fun (scripts/generate-social-assets.mjs); the difference is that the
 * text is read from a CSV instead of blog frontmatter.
 *
 * Usage
 *   node scripts/generate-tip-cards.mjs                          # defaults
 *   node scripts/generate-tip-cards.mjs --csv tips.csv --out-dir cards
 *   node scripts/generate-tip-cards.mjs --template og --photo assets/portrait.webp
 *   node scripts/generate-tip-cards.mjs --limit 5 --captions
 *
 * Run `node scripts/generate-tip-cards.mjs --help` for every option.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const bundledFontDir = path.join(scriptDir, 'assets', 'fonts');

// ---------------------------------------------------------------------------
// Brand tokens — kept identical to generate-social-assets.mjs so tip cards and
// OG cards look like they came from the same brand kit.
// ---------------------------------------------------------------------------
const colors = {
  background: '#101214',
  grid: '#262a2b',
  white: '#f7f8f6',
  muted: '#919594',
  lime: '#b6ff2b',
  ink: '#0a0c0c',
};

// Noto Sans Bengali first so Bengali glyphs render, Noto Sans as the Latin
// fallback. Both ship in scripts/assets/fonts.
const fontFamily = "'Noto Sans Bengali', 'Noto Sans', 'DejaVu Sans', Arial, sans-serif";
const fontFamilyBold = fontFamily;

// Brand strings shown on the cards. Override any of them from the CLI with
// --brand, --initials, --handle, --author and --tagline.
const brand = {
  name: 'TECHTIPS.FUN',
  initials: 'SB',
  handle: '@saonbd',
  author: 'SaonBD',
  tagline: 'SEO · AI · Open source · Web3',
};

// ---------------------------------------------------------------------------
// Font bootstrap
//
// sharp renders SVG text through fontconfig, so a machine with no Bengali font
// installed would draw tofu boxes. We point fontconfig at the fonts bundled in
// scripts/assets/fonts (keeping the usual system font dirs as well) by writing
// a temporary fonts.conf and exporting FONTCONFIG_FILE. This must happen before
// sharp is imported, hence the dynamic import below.
// ---------------------------------------------------------------------------
async function bootstrapFonts() {
  if (process.env.FONTCONFIG_FILE) return { source: 'env', file: process.env.FONTCONFIG_FILE };

  let bundled = [];
  try {
    bundled = (await fs.readdir(bundledFontDir)).filter((f) => /\.(ttf|otf|ttc)$/i.test(f));
  } catch {
    bundled = [];
  }

  const dirs = [
    bundled.length ? bundledFontDir : null,
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    path.join(os.homedir(), '.fonts'),
    path.join(os.homedir(), '.local', 'share', 'fonts'),
  ].filter(Boolean);

  const confDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tip-cards-fc-'));
  const cacheDir = path.join(confDir, 'cache');
  await fs.mkdir(cacheDir, { recursive: true });
  const confPath = path.join(confDir, 'fonts.conf');
  await fs.writeFile(
    confPath,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
${dirs.map((dir) => `  <dir>${dir}</dir>`).join('\n')}
  <cachedir>${cacheDir}</cachedir>
</fontconfig>
`,
    'utf8',
  );
  process.env.FONTCONFIG_FILE = confPath;
  return { source: bundled.length ? 'bundled' : 'system', file: confPath };
}

const fontInfo = await bootstrapFonts();
const sharp = (await import('sharp')).default;
// ---------------------------------------------------------------------------
// CSV reading — the one real change vs. the OG generator, which read markdown
// frontmatter. Handles BOM, CRLF, quoted fields and embedded commas/newlines.
// ---------------------------------------------------------------------------
function parseCsv(source) {
  const text = source.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      // ignore, \n handles the row break
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

async function readTips(csvPath) {
  const table = parseCsv(await fs.readFile(csvPath, 'utf8'));
  if (!table.length) return [];

  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const known = ['category', 'title', 'tip'];
  const isHeader = known.some((name) => header.includes(name));
  const index = (name, fallback) => {
    const at = header.indexOf(name);
    return at === -1 ? fallback : at;
  };
  const cols = isHeader
    ? { category: index('category', 0), title: index('title', 1), tip: index('tip', 2) }
    : { category: 0, title: 1, tip: 2 };

  return table
    .slice(isHeader ? 1 : 0)
    .map((cells) => ({
      category: (cells[cols.category] ?? '').trim(),
      title: (cells[cols.title] ?? '').trim(),
      tip: (cells[cols.tip] ?? '').trim(),
    }))
    .filter((tip) => tip.title || tip.tip);
}

// ---------------------------------------------------------------------------
// Text helpers (same spirit as the OG generator's wrapTitle, but width-aware
// so long Bengali sentences wrap sensibly).
// ---------------------------------------------------------------------------
function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

// Rough advance-width model. Bengali/Devanagari clusters are wider than Latin.
function estimateWidth(text, fontSize) {
  let units = 0;
  for (const char of String(text)) {
    const code = char.codePointAt(0);
    if (char === ' ') units += 0.28;
    else if (code >= 0x0980 && code <= 0x0dff) units += 0.6;
    else if (code >= 0x2e80) units += 1;
    else if (/[iljtf.,;:!'|]/.test(char)) units += 0.3;
    else if (/[A-Z0-9]/.test(char)) units += 0.62;
    else units += 0.53;
  }
  return units * fontSize;
}

function wrapToWidth(text, { fontSize, maxWidth, maxLines = Infinity }) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && estimateWidth(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[kept.length - 1];
    while (last.length > 1 && estimateWidth(`${last}…`, fontSize) > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    kept[kept.length - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

// Filenames stay ASCII and URL-safe: prefer the latin part of the category
// (e.g. "ত্বকের যত্ন (Skincare)" -> "skincare"), then the headline, then "tip".
function asciiSlug(...values) {
  for (const value of values) {
    const slug = String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    if (slug) return slug;
  }
  return 'tip';
}

function textLines(lines, { x, startY, lineHeight, size, fill, weight = 400, family = fontFamily }) {
  return lines
    .map(
      (line, i) =>
        `<text x="${x}" y="${Math.round(startY + i * lineHeight)}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`,
    )
    .join('\n  ');
}

function imageDataUri(buffer, mime = 'image/png') {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}
// ---------------------------------------------------------------------------
// Card templates
// ---------------------------------------------------------------------------

function brandBadge(x, y) {
  const width = Math.round(estimateWidth(brand.name, 20) + 44);
  return `<rect x="${x}" y="${y}" width="${width}" height="40" rx="20" fill="${colors.lime}"/>
  <text x="${x + 22}" y="${y + 27}" fill="${colors.ink}" font-family="${fontFamilyBold}" font-size="20" font-weight="700" letter-spacing="0.3">${escapeXml(brand.name)}</text>`;
}

function avatarBadge(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors.lime}" stroke-width="2"/>
  <text x="${cx - Math.round(r * 0.6)}" y="${cy + Math.round(r * 0.26)}" fill="${colors.lime}" font-family="${fontFamilyBold}" font-size="17" font-weight="700">${escapeXml(brand.initials)}</text>`;
}

function gridOverlay(width, height, step = 90) {
  const rows = [];
  for (let y = step; y < height; y += step) rows.push(`M0 ${y}H${width}`);
  const cols = [];
  for (let x = step; x < width; x += step) cols.push(`M${x} 0V${height}`);
  return `<g stroke="${colors.grid}" stroke-width="1" opacity="0.8"><path d="${rows.join(' ')}"/><path d="${cols.join(' ')}"/></g>`;
}

/**
 * Photo card: full-bleed background photo (or brand grid), bottom-anchored
 * text stack. Layout is anchored to the bottom and scaled off the width, so it
 * works for 1080x1080, 1080x1350 and 1200x630 alike.
 */
function buildPhotoCardSvg({ width, height, category, title, tip, backgroundUri }) {
  const pad = Math.round(width * 0.062);
  const titleSize = Math.round(width * 0.058);
  const tipSize = Math.round(width * 0.033);
  const catSize = Math.round(width * 0.023);
  const titleLineHeight = Math.round(titleSize * 1.3);
  const tipLineHeight = Math.round(tipSize * 1.6);
  const maxTextWidth = width - pad * 2;

  const tipLines = wrapToWidth(tip, {
    fontSize: tipSize,
    maxWidth: maxTextWidth,
    maxLines: Math.max(2, Math.min(6, Math.floor((height * 0.34) / tipLineHeight))),
  });
  const titleLines = wrapToWidth(title, {
    fontSize: titleSize,
    maxWidth: maxTextWidth,
    maxLines: 3,
  });

  const footerBaseline = height - pad;
  const chipHeight = Math.round(catSize * 1.9);

  // Lay the text block out as one unit and place it in the free space between
  // the brand row and the footer, slightly above centre. This keeps short tips
  // from leaving a huge hole at the top of the card.
  const gapChipTitle = Math.round(titleLineHeight * 0.75);
  const gapTitleAccent = Math.round(tipLineHeight * 0.55);
  const gapAccentTip = Math.round(tipLineHeight * 0.95);
  const titleBlockHeight = Math.max(0, titleLines.length - 1) * titleLineHeight;
  const tipBlockHeight = Math.max(0, tipLines.length - 1) * tipLineHeight;
  const blockHeight =
    chipHeight + gapChipTitle + titleBlockHeight + gapTitleAccent + gapAccentTip + tipBlockHeight;

  const topLimit = pad + 40 + Math.round(height * 0.06);
  const bottomLimit = footerBaseline - Math.round(height * 0.075);
  const freeSpace = bottomLimit - topLimit;
  const blockTop =
    freeSpace > blockHeight ? topLimit + Math.round((freeSpace - blockHeight) * 0.5) : topLimit;

  const chipY = blockTop;
  const titleStartY = chipY + chipHeight + gapChipTitle;
  const accentY = titleStartY + titleBlockHeight + gapTitleAccent;
  const tipStartY = accentY + gapAccentTip;

  const background = backgroundUri
    ? `<image href="${backgroundUri}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect width="${width}" height="${height}" fill="${colors.background}"/>\n  ${gridOverlay(width, height)}`;

  const chipText = category || 'Beauty tips';
  const chipWidth = Math.min(
    maxTextWidth,
    Math.round(estimateWidth(chipText, catSize) + catSize * 2.2),
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a0c0c" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="#0a0c0c" stop-opacity="0.72"/>
      <stop offset="1" stop-color="#0a0c0c" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="accentFade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${colors.lime}"/>
      <stop offset="1" stop-color="${colors.lime}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${background}
  <rect width="${width}" height="${height}" fill="url(#scrim)"/>
  ${brandBadge(pad, pad)}
  ${avatarBadge(width - pad - 27, pad + 20, 27)}
  <rect x="${pad}" y="${chipY}" width="${chipWidth}" height="${chipHeight}" rx="${Math.round(chipHeight / 2)}" fill="none" stroke="${colors.lime}" stroke-width="2"/>
  <text x="${pad + Math.round(catSize)}" y="${chipY + Math.round(chipHeight * 0.68)}" fill="${colors.lime}" font-family="${fontFamily}" font-size="${catSize}" font-weight="600">${escapeXml(chipText)}</text>
  ${textLines(titleLines, { x: pad, startY: titleStartY, lineHeight: titleLineHeight, size: titleSize, fill: colors.white, weight: 700 })}
  <line x1="${pad}" y1="${accentY}" x2="${pad + Math.round(width * 0.4)}" y2="${accentY}" stroke="url(#accentFade)" stroke-width="3"/>
  ${textLines(tipLines, { x: pad, startY: tipStartY, lineHeight: tipLineHeight, size: tipSize, fill: colors.white, weight: 400 })}
  <text x="${pad}" y="${footerBaseline}" fill="${colors.lime}" font-family="${fontFamilyBold}" font-size="${Math.round(width * 0.026)}" font-weight="700">${escapeXml(brand.handle)}</text>
  <text x="${width - pad}" y="${footerBaseline}" text-anchor="end" fill="${colors.muted}" font-family="${fontFamily}" font-size="${Math.round(width * 0.024)}">${escapeXml(brand.tagline)}</text>
</svg>`;
}
/**
 * OG card: the original generate-social-assets.mjs geometry (1200x630, grid,
 * circular featured image) but the headline and body come from a CSV row.
 */
function buildOgCardSvg({ category, title, tip, featuredImageUri, authorImageUri }) {
  const width = 1200;
  const height = 630;
  const titleSize = 52;
  const titleLineHeight = titleSize + 17;
  const titleLines = wrapToWidth(title, { fontSize: titleSize, maxWidth: 700, maxLines: 3 });
  const bodyLines = wrapToWidth(tip, {
    fontSize: 24,
    maxWidth: 700,
    maxLines: Math.max(2, 6 - titleLines.length),
  });
  const chipY = 96;
  const chipHeight = 46;
  const titleStartY = chipY + chipHeight + 26;
  const bodyStartY = titleStartY + titleLines.length * titleLineHeight + 22;
  const chipWidth = Math.min(700, Math.round(estimateWidth(category, 20) + 44));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <clipPath id="postImageClip"><circle cx="1023" cy="330" r="165" /></clipPath>
    <clipPath id="authorImageClip"><circle cx="105" cy="528" r="38" /></clipPath>
    <linearGradient id="accentFade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${colors.lime}"/><stop offset="1" stop-color="${colors.lime}" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="${colors.background}"/>
  ${gridOverlay(1200, 630, 90)}
  <path d="M963 -22 C1040 102 1150 198 1095 338 C1050 451 1020 532 967 658" fill="none" stroke="${colors.lime}" stroke-width="3"/>
  <path d="M860 153 C930 95 1035 108 1113 162" fill="none" stroke="#4d6847" stroke-width="1" opacity="0.8"/>
  ${brandBadge(66, 38)}
  ${avatarBadge(1123, 69, 27)}
  <rect x="66" y="${chipY}" width="${chipWidth}" height="${chipHeight}" rx="18" fill="none" stroke="${colors.lime}" stroke-width="2"/>
  <text x="${66 + 20}" y="${chipY + 30}" fill="${colors.lime}" font-family="${fontFamily}" font-size="20" font-weight="600">${escapeXml(category)}</text>
  ${textLines(titleLines, { x: 66, startY: titleStartY, lineHeight: titleLineHeight, size: titleSize, fill: colors.white, weight: 700 })}
  <line x1="66" y1="${bodyStartY - 24}" x2="506" y2="${bodyStartY - 24}" stroke="url(#accentFade)" stroke-width="3"/>
  ${textLines(bodyLines, { x: 66, startY: bodyStartY, lineHeight: 34, size: 24, fill: colors.muted, weight: 400 })}
  <circle cx="105" cy="528" r="38" fill="${colors.background}"/>
  <image href="${authorImageUri}" x="67" y="490" width="76" height="76" preserveAspectRatio="xMidYMid slice" clip-path="url(#authorImageClip)"/>
  <circle cx="105" cy="528" r="42" fill="none" stroke="${colors.lime}" stroke-width="3"/>
  <text x="171" y="526" fill="${colors.white}" font-family="${fontFamilyBold}" font-size="30" font-weight="700">${escapeXml(brand.author)}</text>
  <text x="171" y="569" fill="${colors.muted}" font-family="${fontFamily}" font-size="18">${escapeXml(brand.tagline)}</text>
  ${featuredImageUri
    ? `<image href="${featuredImageUri}" x="858" y="165" width="330" height="330" preserveAspectRatio="xMidYMid slice" clip-path="url(#postImageClip)"/>`
    : `<circle cx="1023" cy="330" r="165" fill="#161a1a"/>
  <text x="1023" y="330" text-anchor="middle" dominant-baseline="central" fill="${colors.lime}" font-family="${fontFamilyBold}" font-size="96" font-weight="700">${escapeXml(brand.initials)}</text>`}
  <circle cx="1023" cy="330" r="175" fill="none" stroke="${colors.lime}" stroke-width="3"/>
  <circle cx="1023" cy="330" r="195" fill="none" stroke="#486144" stroke-width="1" opacity="0.85"/>
</svg>`;
}
// ---------------------------------------------------------------------------
// Rendering pipeline
// ---------------------------------------------------------------------------
const DEFAULTS = {
  csv: path.join(scriptDir, 'examples', 'beauty_tips.csv'),
  outDir: path.join(repoRoot, 'cards'),
  template: 'photo',
  size: null,
  photo: null,
  photoDir: null,
  limit: null,
  filter: null,
  captions: false,
  help: false,
};

const USAGE = `
Generate social-media photo cards from a CSV of tips.

Usage: node scripts/generate-tip-cards.mjs [options]

Options:
  --csv <file>        CSV with category,title,tip columns
                      (default: scripts/examples/beauty_tips.csv)
  --out-dir <dir>     where PNGs are written (default: public/social-cards)
  --template <name>   photo (default) | og
  --size <WxH>        card size (default: 1080x1080 photo, 1200x630 og)
  --photo <file>      background/featured photo
  --photo-dir <dir>   rotate through every image in a folder
  --limit <n>         only the first n rows
  --filter <text>     keep rows whose category/title/tip contains text
  --captions          also write captions.txt next to the PNGs
  --brand <text>      brand pill text (default: TECHTIPS.FUN)
  --initials <text>   monogram in the corner badge (default: SB)
  --handle <text>     footer handle (default: @saonbd)
  --author <text>     author name on the og template (default: SaonBD)
  --tagline <text>    footer tagline
  --help              show this message
`;

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  const takesValue = new Set([
    'csv', 'out-dir', 'template', 'size', 'photo', 'photo-dir', 'limit', 'filter',
    'brand', 'initials', 'handle', 'author', 'tagline',
  ]);
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if (key === 'help') args.help = true;
    else if (key === 'captions') args.captions = true;
    else if (takesValue.has(key)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`missing value for --${key}`);
      i += 1;
      const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      args[camel] = key === 'limit' ? Number.parseInt(value, 10) : value;
    } else throw new Error(`unknown option --${key}`);
  }
  if (!['photo', 'og'].includes(args.template)) throw new Error(`unknown template: ${args.template}`);
  return args;
}

async function firstExisting(...candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

const rasterExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);

async function collectPhotos({ photo, photoDir }) {
  const photos = [];
  if (photo) photos.push(path.resolve(photo));
  if (photoDir) {
    const entries = await fs.readdir(path.resolve(photoDir));
    for (const entry of entries.sort()) {
      if (rasterExtensions.has(path.extname(entry).toLowerCase())) {
        photos.push(path.join(path.resolve(photoDir), entry));
      }
    }
  }
  return photos;
}

function parseSize(value, fallback) {
  if (!value) return fallback;
  const match = String(value).match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (!match) throw new Error(`invalid --size: ${value} (expected e.g. 1080x1080)`);
  return { width: Number.parseInt(match[1], 10), height: Number.parseInt(match[2], 10) };
}
function buildCaption(row) {
  const hashtags = ['#beauty', '#skincare', '#selfcare', '#beautytips', '#বাংলা'];
  return [row.title, row.tip, '', hashtags.join(' ')].filter((line) => line !== undefined).join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE.trim());
    return 0;
  }

  const brandOverrides = {
    brand: 'name',
    initials: 'initials',
    handle: 'handle',
    author: 'author',
    tagline: 'tagline',
  };
  for (const [flag, property] of Object.entries(brandOverrides)) {
    if (args[flag]) brand[property] = args[flag];
  }

  const csvPath = path.resolve(args.csv);
  let rows = await readTips(csvPath);
  if (args.filter) {
    const needle = args.filter.toLowerCase();
    rows = rows.filter((row) =>
      [row.category, row.title, row.tip].join(' ').toLowerCase().includes(needle),
    );
  }
  if (args.limit) rows = rows.slice(0, args.limit);
  if (!rows.length) {
    console.error(`error: no rows found in ${csvPath}`);
    return 1;
  }

  const isOg = args.template === 'og';
  const { width, height } = parseSize(
    args.size,
    isOg ? { width: 1200, height: 630 } : { width: 1080, height: 1080 },
  );

  const photos = await collectPhotos(args);
  const outDir = path.resolve(args.outDir);
  await fs.mkdir(outDir, { recursive: true });

  let authorImageUri = '';
  const authorPath = await firstExisting(
    path.join(repoRoot, 'assets', 'portrait.webp'),
    path.join(repoRoot, 'public', 'portrait.webp'),
  );
  if (authorPath) {
    const buffer = await sharp(authorPath).resize(76, 76, { fit: 'cover' }).png().toBuffer();
    authorImageUri = imageDataUri(buffer);
  }

  const written = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const photo = photos.length ? photos[i % photos.length] : null;
    const headline = row.title || row.tip;
    const body = row.title ? row.tip : '';
    let svg;

    if (isOg) {
      // No photo supplied? The template falls back to a brand monogram.
      const featuredPath = photo;
      const featuredUri = featuredPath
        ? imageDataUri(
            await sharp(featuredPath, { failOn: 'none' })
              .resize(330, 330, { fit: 'cover', position: 'attention' })
              .png()
              .toBuffer(),
          )
        : '';
      svg = buildOgCardSvg({
        category: row.category || 'Beauty tips',
        title: headline,
        tip: body,
        featuredImageUri: featuredUri,
        authorImageUri,
      });
    } else {
      const backgroundUri = photo
        ? imageDataUri(
            await sharp(photo, { failOn: 'none' })
              .resize(width, height, { fit: 'cover', position: 'attention' })
              .png()
              .toBuffer(),
          )
        : null;
      svg = buildPhotoCardSvg({
        width,
        height,
        category: row.category,
        title: headline,
        tip: body,
        backgroundUri,
      });
    }

    const name = `${String(i + 1).padStart(2, '0')}-${asciiSlug(row.category, headline)}.png`;
    const file = path.join(outDir, name);
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
    written.push({ file, row });
  }

  if (args.captions) {
    const captionsPath = path.join(outDir, 'captions.txt');
    const text = written
      .map(({ file, row }, i) => `--- ${i + 1}. ${path.basename(file)} ---\n${buildCaption(row)}\n`)
      .join('\n');
    await fs.writeFile(captionsPath, text, 'utf8');
  }

  console.log(`font source: ${fontInfo.source}`);
  console.log(
    `Generated ${written.length} card(s) in ${path.relative(repoRoot, outDir) || outDir} ` +
      `(${width}x${height}, ${args.template} template).`,
  );
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
}
