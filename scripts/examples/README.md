# Text cleanup → CSV example

`beauty_tips_raw.txt` is a real-world example of a scraped report: Bengali
beauty tips mixed with inline citation markers like
`[1] (https://www.prothomalo.com/...)`.

Run the cleaner from the repo root:

```bash
# Bengali bullet tips -> CSV (default)
python scripts/clean_text_to_csv.py scripts/examples/beauty_tips_raw.txt \
    -o beauty_tips.csv

# Also dump the fully de-cluttered plain text
python scripts/clean_text_to_csv.py scripts/examples/beauty_tips_raw.txt \
    -o beauty_tips.csv --cleaned-text beauty_tips_clean.txt
```

Output (`beauty_tips.csv`, UTF-8 with BOM so Excel shows Bengali correctly):

| category | title | tip |
| --- | --- | --- |
| ত্বকের যত্ন (Skincare) | সানস্ক্রিন ব্যবহার | বাইরে বের হওয়ার আগে কমপক্ষে এসপিএফ (SPF) ৩০ যুক্ত সানস্ক্রিন লাগান। |
| ত্বকের যত্ন (Skincare) | নিয়মিত মুখ পরিষ্কার | দিনে অন্তত দুইবার মৃদু ফেসওয়াশ দিয়ে মুখ ধুয়ে নিন। |
| ... | ... | ... |

## Tests

```bash
python -m unittest discover -s scripts/tests -v
```

## Social-media cards from the same CSV

`scripts/generate-tip-cards.mjs` is a fork of the OG image generator
(`scripts/generate-social-assets.mjs`). Same rendering pipeline, but the text
comes from the CSV rows instead of blog frontmatter.

```bash
# 17 square photo cards + captions.txt in public/social-cards/
npm run cards:tips

# explicit paths, a background photo and a 4:5 crop
node scripts/generate-tip-cards.mjs \
    --csv scripts/examples/beauty_tips.csv \
    --out-dir public/social-cards \
    --photo public/portrait.webp \
    --size 1080x1350 \
    --captions

# the classic 1200x630 OG layout instead of the square photo card
node scripts/generate-tip-cards.mjs --template og --limit 3
```

Each card shows the category chip, the row's `title` as the headline and the
row's `tip` as the body. Bengali renders because Noto Sans Bengali (plus Noto
Sans for latin text) ships in `scripts/assets/fonts/` and is registered with
fontconfig at runtime — no system font installation needed.
