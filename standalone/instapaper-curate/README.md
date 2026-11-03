# Instapaper Curate

Small, dependency-free automation for **your own** Instapaper account, using the
[Instapaper Public API](https://instapaper.com/developers/) (OAuth 1.0a, `x_auth`).

Three things it does:

| Mode | What happens |
| :--- | :--- |
| **Daily rotation** | Every day it takes the next link from `data/read-queue.json` and saves it into your Instapaper folder — one article a day, looping when the queue runs out. |
| **Add bookmark** | Save any URL on demand (a workflow button, or the CLI). |
| **Snapshot** | Writes the contents of one folder to `data/instapaper-bookmarks.json` and commits it, so your list is backed up in git. |

Everything is a **private write to your own account**. Nothing is published, hosted
or served to anyone — this repo is a tool, not a site.

> Extracted from the `/read` page of [techtips.fun](https://www.techtips.fun), where
> the *display* half was retired (presenting saved links as a public news feed means
> republishing other publishers' headlines/excerpts). The part that saves links into
> your own account has none of that problem, so it lives on its own here.

## Setup

### 1. API credentials

Register an API consumer at <https://instapaper.com/developers/> and note the
**consumer key** and **consumer secret**. The scripts exchange your email/password
for a user token (`x_auth`), so no browser OAuth dance is needed.

### 2. Local use

```bash
git clone https://github.com/saonbd1/Instapaper-Curate.git
cd Instapaper-Curate
cp .env.example .env          # then fill it in
set -a; source .env; set +a   # export the vars for the shell

npm test                      # 17 tests, no network
npm run sync                  # snapshot the folder -> data/instapaper-bookmarks.json
npm run rotate                # save the next queued link
npm run add -- https://example.com/article "Optional title" "Optional description"
```

Node 22+ is the only requirement — no dependencies, no build step.

### 3. GitHub Actions

Add these under **Settings → Secrets and variables → Actions → Secrets**:

- `INSTAPAPER_CONSUMER_KEY`
- `INSTAPAPER_CONSUMER_SECRET`
- `INSTAPAPER_EMAIL`
- `INSTAPAPER_PASSWORD`

Optionally add a **variable** (not a secret) `INSTAPAPER_FOLDER` to change the target
folder without touching code. It defaults to `Tech News`; the built-in `unread`,
`starred` and `archive` lists also work.

## Workflows

| Workflow | Trigger | Does |
| :--- | :--- | :--- |
| `daily-read-link.yml` | daily 09:00 UTC + manual | Saves the next queued link, commits the cursor in `data/read-queue-state.json` |
| `add-bookmark.yml` | manual (Actions → Run workflow) | Saves one URL; inputs for url / title / description / folder |
| `sync-bookmarks.yml` | Mondays 08:00 UTC + manual | Refreshes the `data/instapaper-bookmarks.json` snapshot |

The repo needs **Read and write** workflow permissions (Settings → Actions → General →
Workflow permissions) so the daily and sync jobs can commit.

## Scripts

| Script | Purpose |
| :--- | :--- |
| `scripts/instapaper.mjs` | OAuth 1.0a client: `listFolders`, `resolveFolder`, `listAllBookmarks` (paged), `addBookmark` |
| `scripts/daily-read-link.mjs` | Rotate: next entry from the queue → Instapaper |
| `scripts/add-instapaper-bookmark.mjs` | CLI: `add-instapaper-bookmark.mjs <url> [title] [description] [--folder="Tech News"]` |
| `scripts/sync-instapaper-bookmarks.mjs` | One folder → `data/instapaper-bookmarks.json` |
| `scripts/generate-read-queue.mjs` | Rebuild the queue from a blog folder (see below) |
| `scripts/tests/test-instapaper-folders.mjs` | 17 tests: folder matching, `folder_id` on list/add, `have` paging, meta-row filtering |

## The queue

`data/read-queue.json` is just an array; edit it by hand or generate it:

```json
[{ "url": "https://example.com/a", "title": "A", "description": "optional" }]
```

`data/read-queue-state.json` holds `{ "lastIndex": n }` — the cursor the daily run
commits. Delete it (or set `lastIndex: -1`) to restart from the top.

To rebuild the queue from a blog repo's content folder:

```bash
node scripts/generate-read-queue.mjs \
  --blog ../TechtipsFun/src/content/blog \
  --base https://www.techtips.fun/blog
```

`--blog` defaults to `src/content/blog`, `--base` to `https://www.techtips.fun/blog`,
`--out` to `data/read-queue.json`.

## Folder behaviour

Instapaper's `bookmarks/list` silently returns the **unread home list** when no
`folder_id` is sent, so every script resolves the folder name through
`folders/list` first (case-insensitive, matches `title` or `display_title`):

- `sync-instapaper-bookmarks.mjs` exits **1** and lists the folders that do exist if
  the name is wrong — better than quietly snapshotting the wrong list.
- `daily-read-link.mjs` and `add-instapaper-bookmark.mjs` warn and fall back to the
  default unread list, so a typo never throws away a queued link.
- Lists are paged with the API's `have` parameter (500 per request), so a folder with
  thousands of items is read completely.
