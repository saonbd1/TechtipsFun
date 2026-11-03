# patches/

Changes an automated session could not push directly. GitHub rejects pushes
from a GitHub App token that lacks the `workflows` permission:

```
! [remote rejected] ... (refusing to allow a GitHub App to create or update
workflow `.github/workflows/<file>` without `workflows` permission)
```

Apply a patch with:

```bash
git apply patches/<name>.patch
```

Delete the patch once its change is in the tree.

## schedule-posts-og-card-slug.patch

Normalises the OG card name when `schedule-posts.yml` publishes a staged post,
and reports the normalised slug to the LinkedIn / IndexNow steps. Pairs with
`scripts/check-og-cards.mjs` and `src/utils/post-slug.mjs` (committed separately).

## instapaper-folder-env.patch

Adds `INSTAPAPER_FOLDER` to the **add** step of `daily-read-link.yml` — the last
of the four add/sync steps without it (the other three are already in `main`).
Today the scripts fall back to their built-in `Tech News` default, so nothing is
broken; the line only matters once `vars.INSTAPAPER_FOLDER` is set to a different
folder, where the sync would move but the daily add would not. The patch also
drops two stray blank lines inside the `env:` blocks.

One line — either apply the patch:

```bash
git pull
git apply patches/instapaper-folder-env.patch
git commit -am "ci(instapaper): pass INSTAPAPER_FOLDER to the daily add step"
git push
```

or paste `          INSTAPAPER_FOLDER: ${{ vars.INSTAPAPER_FOLDER || 'Tech News' }}`
into the **“Add next link from read queue to Instapaper”** step in the GitHub web
editor, directly after `INSTAPAPER_PASSWORD`. Delete this file once applied.

## Removed: `.github/workflows/squad-share.yml`

The "Post new article to Squad via Slack" workflow was deleted on 2026-10-16
along with `squad-share-daily-dev-fix.patch` (which had been applied as
`51cd8fc`). It could never do its job, so keeping it only produced failing runs.

It assumed that posting to a Slack channel connected to a daily.dev Squad would
publish that post to the Squad. **daily.dev's Slack integration is one-way —
Squad → Slack.** It sends a notification *into* Slack when a new post is
published *in* the Squad:

> "Real-time Updates: Receive instant notifications in Slack whenever new posts
> are published in your Squad."
> — daily.dev docs, *Slack integration for Squads* (updated 2026-09-28)

Nothing posted into that Slack channel ever becomes a Squad post. The Public API
is no alternative either: all 54 documented endpoints were checked against
`https://api.daily.dev/public/v1/docs/yaml` and none of them touch Squads — the
only write operations are bookmarks, custom-feed filters, notifications,
profile / stack / experiences, plugins and signup.

**So there is no supported way to publish to a Squad from CI.** New articles have
to go to the Squad by hand — Squad page → composer → **Share a link** — which is
what daily.dev itself recommends for personal blogs, since personal blogs are
explicitly not eligible as daily.dev *sources* ("Corporate and personal blogs are
not eligible. Consider starting a Squad instead.").

If a Slack notification is ever wanted again for a *different* reason (e.g. "ping
me when a new post goes live"), it needs its own workflow, a fresh
`SLACK_WEBHOOK_URL` secret, and a message that does not claim to publish to
daily.dev.


