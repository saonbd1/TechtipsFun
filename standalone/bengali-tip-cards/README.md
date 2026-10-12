# bengali-tip-cards

Two small tools that turn messy scraped text into publishable social-media content:

1. **`clean_text_to_csv.py`** — strips the noise out of a pasted/scraped article
   (inline `[1] (https://…)` citations, bare URLs, bullet glyphs, zero-width
   junk, dangling punctuation) and writes the surviving bullet tips to a CSV.
2. **`generate-tip-cards.mjs`** — renders one social-media card per CSV row
   (SVG → [sharp](https://sharp.pixelplumbing.com/) → PNG), with the brand kit,
   category chip, headline and body text taken straight from the row.

Bengali text renders correctly out of the box: the repo ships **Noto Sans
Bengali** (plus Noto Sans for the latin fallback) and registers it with
fontconfig at runtime, so no system font installation is needed.

![Sample card](examples/preview/01-skincare.png)

## Quick start

```bash
git clone https://github.com/saonbd1/bengali-tip-cards.git
cd bengali-tip-cards
npm install

# 1. messy text -> clean CSV
python3 scripts/clean_text_to_csv.py scripts/examples/beauty_tips_raw.txt \
    -o scripts/examples/beauty_tips.csv

# 2. CSV rows -> social cards in ./cards
npm run cards

# every card also gets a ready-to-post caption
npm run cards -- --captions
```

The bundled example (`scripts/examples/beauty_tips_raw.txt`) is a scraped
Bengali beauty-tips article; running the two commands above produces
`scripts/examples/beauty_tips.csv` (17 tips) and 17 cards.

## Step 1 — clean the text

```bash
python3 scripts/clean_text_to_csv.py INPUT.txt -o OUTPUT.csv [options]
```

| Option | What it does |
| --- | --- |
| `-o, --output` | output CSV path (default `cleaned_tips.csv`) |
| `--cleaned-text` | also write the fully de-cluttered plain text |
| `--all-lines` | export non-bullet prose as rows too (default: bullets only) |
| `--no-bengali-filter` | keep bullets in any language (default: Bengali only) |
| `--delimiter` | CSV delimiter (default `,`) |

The CSV it writes has three columns: `category`, `title`, `tip` — where
`title` is the `Leading phrase:` prefix of a bullet and `category` is the
nearest heading above it.

## Step 2 — render the cards

```bash
node scripts/generate-tip-cards.mjs [options]
```

| Option | What it does |
| --- | --- |
| `--csv <file>` | CSV to read (default `scripts/examples/beauty_tips.csv`) |
| `--out-dir <dir>` | where PNGs are written (default `cards/`) |
| `--template <name>` | `photo` (default) or `og` |
| `--size <WxH>` | card size (default `1080x1080`, `og` is `1200x630`) |
| `--photo <file>` | background photo (photo template) / featured image (og) |
| `--photo-dir <dir>` | rotate through every image in a folder, one per row |
| `--limit <n>` | only the first `n` rows |
| `--filter <text>` | keep rows whose category/title/tip contains `text` |
| `--captions` | also write `captions.txt` next to the PNGs |
| `--brand`, `--initials`, `--handle`, `--author`, `--tagline` | override the brand strings on the card |

### Templates

| `photo` (1080×1080) | `og` (1200×630) |
| --- | --- |
| Full-bleed photo (or brand grid), darkened with a scrim, category chip, headline, tip, handle footer. | The classic OG card layout: grid background, circular featured image, author row. |

Files are named `01-skincare.png`, `02-skincare.png`, … using the latin part of
the category so the names stay URL-safe even when the content is Bengali.

### Examples

```bash
# square photo cards with your own background image
node scripts/generate-tip-cards.mjs --photo assets/portrait.webp

# 4:5 portrait crop for Instagram
node scripts/generate-tip-cards.mjs --size 1080x1350

# one card per image in a folder
node scripts/generate-tip-cards.mjs --photo-dir photos/ --captions

# classic OG layout, first three rows only
node scripts/generate-tip-cards.mjs --template og --limit 3

# different brand
node scripts/generate-tip-cards.mjs --brand MYBRAND --handle @myhandle
```

## Run in a Codespace (or any dev container)

The repo ships a `.devcontainer/` config, so:

1. Open the repo on GitHub → **Code** → **Codespaces** → **Create codespace on main**
2. Wait for `npm install` to finish (it runs automatically via `postCreateCommand`)
3. In the terminal:

```bash
npm test                                        # 12 tests, no setup needed
npm run cards -- --captions                     # 17 cards in ./cards
python3 scripts/clean_text_to_csv.py your.txt -o tips.csv && npm run cards -- --csv tips.csv
```

Then right-click a PNG in the Explorer → **Download**. Everything runs offline
once `npm install` is done — no `apt-get install fonts-*` step, because the
Bengali fonts are bundled and registered at runtime.

### Or let Actions build them

`.github/workflows/cards.yml` is a manual workflow: **Actions → Generate cards →
Run workflow**, pick the CSV/template/size/limit, and download the `cards`
artifact when it finishes. Nothing is committed back to the repo.

## CSV format

Any CSV with a `category,title,tip` header works — the cleaner's output, or
your own. Without a header the first three columns are used positionally.

```csv
category,title,tip
ত্বকের যত্ন (Skincare),সানস্ক্রিন ব্যবহার,বাইরে বের হওয়ার আগে কমপক্ষে এসপিএফ (SPF) ৩০ যুক্ত সানস্ক্রিন লাগান।
```

## Fonts

`scripts/assets/fonts/` holds Noto Sans Bengali (Regular/Bold/SemiBold) and
Noto Sans (Regular/Bold), all SIL OFL 1.1. The card generator writes a
temporary `fonts.conf` pointing at that folder and exports `FONTCONFIG_FILE`
before loading sharp, so Bengali conjuncts and Bengali digits render on any
machine — including bare CI containers with no fonts installed. See
`scripts/assets/fonts/README.md` for sources.

## Requirements

- Node.js ≥ 20 (`sharp` is the only dependency)
- Python ≥ 3.8 (standard library only)

## Tests

```bash
npm test          # python -m unittest discover -s scripts/tests -v
```

## Layout

```
scripts/
  clean_text_to_csv.py        # text -> CSV
  generate-tip-cards.mjs      # CSV -> PNG cards
  assets/fonts/               # bundled Noto fonts (OFL)
  examples/                   # raw article, cleaned CSV, sample card
  tests/                      # unit tests for the cleaner
assets/portrait.webp          # default author portrait
cards/                        # generated output (git-ignored)
.devcontainer/                # Codespaces / dev container config
.github/workflows/cards.yml   # manual workflow that renders + uploads cards
```

## License

MIT (code). Bundled fonts are SIL OFL 1.1.
