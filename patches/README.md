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

## squad-share-daily-dev-fix.patch

Makes `squad-share.yml` — "Post new article to Squad via Slack", which announces
each new post to the Slack channel behind the daily.dev Squad — actually work.
It currently fails on every real post with `curl: (3) URL rejected: Malformed
input to a URL function`, and passes silently on pushes that only *update* a
post, which is why the failure was easy to miss.

The patch:

- fails fast with an explicit `::error::` naming the missing secret;
- derives the post slug the way `src/utils/post-slug.mjs` does, instead of from
  the raw filename (which produced 404 links for `Simple-Ghostty-…` and
  `update-tpm- …(1).md`);
- fixes the double-encoded 🚀 / — in the message (`c3b0 c5b8 c5a1 e282ac`);
- builds the payload with `jq --arg`, so a title containing quotes cannot break
  the JSON;
- trims CRLF frontmatter, so the one CRLF post keeps a clean title;
- passes the changed-file list through the environment instead of interpolating
  it into the shell, and uses LF line endings like every other workflow.

**The secret still has to be set by hand**: Settings → Secrets and variables →
Actions → New repository secret, named `SLACK_WEBHOOK_URL`, with the Slack
incoming-webhook URL for the Squad channel. Without it the step cannot post.

