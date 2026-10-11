# reels/ci

Two GitHub Actions workflows live here because the tool that generated them
could not write into `.github/workflows/` — that path requires a token with the
`workflows` permission, and the available credential only has `contents`.

Each file is a drop-in replacement for the one already in `.github/workflows/`.
You can either `git mv` it into place, or copy the few changed lines across by
hand.

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

A copy of **Check links** with a weekly schedule added.

The version live in `.github/workflows/` only runs on `push` and `pull_request`
— and because scheduled publishes are pushed with `GITHUB_TOKEN`, which triggers
nothing, posts published by the scheduler were never link-checked. Link rot is a
time-based problem, so it belongs on a timer rather than on every commit.

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 6 * * 1"   # Mondays 06:00 UTC - weekly link-rot sweep
```

Only those two `schedule:` lines differ from the file already on `main`.

```bash
git mv reels/ci/check-links.yml .github/workflows/check-links.yml
git commit -m "ci: run the link checker weekly"
git push
```

Or, if you would rather not move the file, paste the two `schedule:` lines into
`.github/workflows/check-links.yml` directly after the `pull_request:` block.

Note: the checker currently fails on `429` responses (Google rate-limits
GitHub's runner IPs, so a live link can be reported as `broken`), and its
internal link check compares the slug to the filename — which flags Astro's
lowercased slugs as missing. Neither means the content is broken. See
[`../../scripts/check-links.mjs`](../../scripts/check-links.mjs).
