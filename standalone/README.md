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

## `instapaper-curate/`

Save links into your own Instapaper account: a daily rotation through
`data/read-queue.json`, on-demand bookmarks, and a folder snapshot committed to
git. Dependency-free OAuth 1.0a client, 17 tests, three GitHub Actions
workflows. Private tool — nothing is published. See
`instapaper-curate/README.md`.

Publish it as a new GitHub repo:

```bash
# 1. create an empty repo (web UI, or: gh repo create saonbd1/Instapaper-Curate --public)
# 2. from this folder
cd standalone/instapaper-curate
git init -b main
git add .
git commit -m "Instapaper Curate: daily read queue, ad-hoc bookmarks, folder snapshot"
git remote add origin git@github.com:saonbd1/Instapaper-Curate.git
git push -u origin main
```

Then add the four `INSTAPAPER_*` secrets in the new repo (see its README).
