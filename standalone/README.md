# Standalone projects

Code kept here is meant to be lifted into its own repository.

## `bengali-tip-cards/`

Turn messy scraped text into a clean CSV, then render social-media cards from
each row. Self-contained: own `package.json`, own bundled Bengali fonts, own
tests. See `bengali-tip-cards/README.md`.

Publish it as a new GitHub repo:

```bash
# 1. create an empty repo (web UI, or: gh repo create saonbd1/bengali-tip-cards --public)
# 2. from this folder
cd standalone/bengali-tip-cards
git init -b main
git add .
git commit -m "Bengali tip cards: clean scraped text to CSV, render social cards from rows"
git remote add origin git@github.com:saonbd1/bengali-tip-cards.git
git push -u origin main
```

`node_modules/` and the generated `cards/` folder are git-ignored, so the
commit stays small (fonts ~1.7 MB, preview PNGs ~180 KB).
