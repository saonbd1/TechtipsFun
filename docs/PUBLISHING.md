# Publishing docs to GitBook

## Recommended: GitHub sync

1. Create a separate GitHub repo for docs (e.g., `saonbd1/techtips-docs`).
2. Copy the contents of this `docs/` folder into that repo.
3. In GitBook: **Space → Sync with GitHub** → connect `saonbd1/techtips-docs`.
4. GitBook auto-publishes on every push.

## Manual import (one-time)

1. Create a space in GitBook.
2. Import Markdown files from this `docs/` folder.
3. Edit going forward in GitBook's editor.

## Cross-linking (no duplication)

- From your Astro blog, add a nav link to your GitBook URL.
- From GitBook, add a link back to `https://www.techtips.fun/blog`.
- Do **not** copy blog posts into GitBook unless you add `rel=canonical` or `noindex` to one copy.
