# article-reels

Vertical 1080x1920 reels, one MP4 per published article, generated
automatically by the **Generate article reels** workflow
([source](../reels/ci/article-reels.yml) — install it with
`git mv reels/ci/article-reels.yml .github/workflows/` before the first run).

- File name is the article slug: `article-reels/<slug>.mp4`.
- Produced from the Markdown in `src/content/blog/` - no extra input needed, so
  re-running the workflow regenerates the same video from the same article.
- The newest article is always rendered first; automatic runs are capped so a
  large backfill cannot run for hours. Automatic runs render at most 3 reels
  per run; manual runs choose their own `max`.

## Triggering it

It runs by itself when a post is published:

- when a commit adds a file under `src/content/blog/` (a normal push), and
- when the **Schedule post publishing** workflow finishes (scheduled publishes
  are pushed with `GITHUB_TOKEN`, which does not fire `push` events - hence the
  second trigger).

Manual runs (Actions -> Generate article reels -> Run workflow):

| Input | Effect |
| --- | --- |
| `slug` | Render just that one article |
| `max` | How many missing reels to render in this run (default 5) |
| `force` | Re-render even if a reel already exists |
| `refresh` | How many outdated reels (older design) to re-render in this run |

## Daily refresh of older reels

The workflow also runs every day at 10:30 UTC (16:30 Dhaka). Besides any
missing reels, it re-renders **2 outdated reels** per day, newest posts first,
until every reel matches the current design. After that the daily run renders
nothing.

- `.reel-versions.json` records which design version each reel was rendered
  with (reels not listed count as version 1). The workflow updates it.
- To push a future redesign to all reels, bump `REEL_VERSION` in
  `reels/scripts/build-reel-props.mjs`; the daily refresh does the rest.
- Change the pace with `REFRESH_PER_DAY` in the workflow, or run it manually with
  a bigger `refresh` value to catch up faster.
- Check progress locally: `cd reels && node scripts/list-missing-reels.mjs --status`.

To backfill everything at once, run it manually with `max: 100`.

## YouTube uploads (and the 7-day token trap)

**Post reels to YouTube** uploads up to 3 new MP4s per run (`.mp4` → Shorts,
title derived from the file name) and records each success in
`.youtube-upload-manifest.json` so a re-run never double-posts. It needs three
repo Secrets: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`
(optional `YT_PLAYLIST_ID`).

Mint the refresh token once, on your own machine:

```bash
export YT_CLIENT_ID=...apps.googleusercontent.com
export YT_CLIENT_SECRET=...
python scripts/get-youtube-refresh-token.py        # prints the token
gh secret set YT_REFRESH_TOKEN --body "<token>"
python scripts/upload-reels-to-youtube.py --check-auth
```

### Which OAuth client type?

`YT_CLIENT_ID`/`YT_CLIENT_SECRET` are **any** OAuth client in that project; the
client *type* only changes redirect-URI bookkeeping, not how long the refresh
token lives.

| Client type | What you must do | Run the helper with |
| --- | --- | --- |
| **Desktop app** | nothing — no redirect URIs to register | plain `python scripts/get-youtube-refresh-token.py` (random free port) |
| **Web application** (if you already have one) | add a fixed loopback URI, e.g. `http://127.0.0.1:8080`, under *Credentials → client → Authorized redirect URIs* | `--port 8080` (port must match exactly; wildcards are rejected) |

Google's redirect-URI rules exempt localhost from the HTTPS-only and
no-raw-IP rules, so `http://127.0.0.1:8080` is legal on a web client. A separate
Desktop client is only *nicer*: no registration, and revoking it later does not
touch the OAuth grant your other integrations (e.g. Blogger) use from the same
client + account.

**Either way, publish the OAuth app** (Google Auth Platform → Audience →
Publish app). While the publishing status stays `Testing`, Google expires every
refresh token **7 days** after it is issued, so the daily job starts failing
with:

```
{"error": "invalid_grant", "error_description": "Token has been expired or revoked."}
```

Publishing the app ("In production") removes that timer; the token then only
dies if it is revoked, unused for 6 months, or pushed out by 50+ newer tokens
for the same client + user pair. The helper prints
`refresh_token_expires_in` when Google still considers the token temporary, so
a 7-day token is obvious at mint time.

Other failures you may see in the log:

| Error | Meaning |
| --- | --- |
| `invalid_grant` | refresh token dead — re-mint (see above) |
| `uploadLimitExceeded` | per-channel daily upload cap; verify the channel |
| `quotaExceeded` | 10,000 unit/day API quota spent (~6 uploads), resets midnight PT |

## Rendering locally instead

```bash
cd reels
npm run reel -- --latest                                   # newest article
node scripts/render-reel.mjs --slug <slug> --out "$PWD/../article-reels/<slug>.mp4"
node scripts/list-missing-reels.mjs --limit 5              # what the workflow would pick
```

See [`reels/README.md`](../reels/README.md) for the pipeline, or run the GUI
with `npm run gui`.

## Repo size

Each reel is roughly 1-3 MB. GitHub blocks files over 100 MB and warns once a
repo passes ~1 GB, so this is fine for years of posts; if it ever matters,
switch the workflow to artifacts only, or move this folder to Git LFS.
