# reels/ci

Two staged copies of GitHub Actions workflows live here because the tool that
generated them could not write into `.github/workflows/` — that path requires a
token with the `workflows` permission, and the available credential only has
`contents`.

`article-reels.yml` still needs installing (see below). `check-links.yml` is a
mirror of the manual-only version of the live workflow, staged here because a
workflow file cannot be pushed by this token.

---

## `article-reels.yml`

This is the **Generate article reels** workflow. Its real home is
`.github/workflows/article-reels.yml`.

```bash
mkdir -p .github/workflows
git mv reels/ci/article-reels.yml .github/workflows/article-reels.yml
git commit -m "ci: install the article-reels workflow"
git push
```

Then check it appears under **Actions → Generate article reels**, and run it
once with `max: 100` to backfill reels for the posts that predate it.

Why it has three triggers, how it decides what to render, and how to render
locally instead are all documented at the top of the workflow file and in
[`../../article-reels/README.md`](../../article-reels/README.md).

---

## `check-links.yml`

A copy of **Check links** with the trigger changed to `workflow_dispatch` only.
Its real home is `.github/workflows/check-links.yml`.

The live file **still runs on `push` and `pull_request`** — the session that made
this change could not push a workflow file (no `workflows` permission; see
[`../../patches/README.md`](../../patches/README.md)), so it ships as
[`../../patches/check-links-manual-trigger.patch`](../../patches/check-links-manual-trigger.patch).
Apply either the patch or this copy:

```bash
git apply patches/check-links-manual-trigger.patch
git commit -am "ci: make the link checker manual-only"
git push

# or, without git:
cp reels/ci/check-links.yml .github/workflows/check-links.yml
```

Once applied, the workflow is **manual-only**: it fires on no push, no pull
request and no schedule. Start it from **Actions → Check links → Run workflow**,
or:

```bash
gh workflow run check-links.yml                      # default: --fail-on=dead
gh workflow run check-links.yml -f fail_on=redirect  # also fail on redirect chains
```

The `fail_on` input (`dead` | `redirect` | `all` | `none`) is passed straight to
`scripts/check-links.mjs --fail-on=…`, so the same workflow covers a quick
"did I break a link?" check and a full link-rot audit. The weekly cron sweep
this file used to carry was dropped when the trigger was made manual.

Once the change is in the tree, delete both
`patches/check-links-manual-trigger.patch` and this copy, as
[`../../patches/README.md`](../../patches/README.md) asks.

Note: `429`/`408` answers are classified as `rate_limited` (never fatal — Google
rate-limits GitHub's runner IPs), `401`/`403` as `blocked` (a datacenter
fingerprint, worth opening in a browser before deleting a link), and internal
`/blog/<slug>/` links are normalised through `postSlug()` so lowercased Astro
slugs are not reported as missing. See
[`../../scripts/check-links.mjs`](../../scripts/check-links.mjs).
