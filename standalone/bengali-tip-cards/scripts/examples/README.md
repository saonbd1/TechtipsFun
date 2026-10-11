# Example data

| File | What it is |
| --- | --- |
| `beauty_tips_raw.txt` | A scraped Bengali beauty-tips article, straight from the wild — full of `[1] (https://…)` citation markers. |
| `beauty_tips.csv` | The cleaned output: 17 rows of `category,title,tip`. |
| `beauty_tips_clean.txt` | The same input after `--cleaned-text`, with every link and stray glyph removed. |
| `preview/` | A few generated cards, committed so the README has something to show. |

Regenerate everything from scratch:

```bash
python3 scripts/clean_text_to_csv.py scripts/examples/beauty_tips_raw.txt \
    -o scripts/examples/beauty_tips.csv \
    --cleaned-text scripts/examples/beauty_tips_clean.txt

node scripts/generate-tip-cards.mjs --captions --limit 3 --out-dir scripts/examples/preview
```
