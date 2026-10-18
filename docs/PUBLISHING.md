# Publishing Project Docs to GitBook

## Rule: Blog posts are never published to GitBook

Only files inside `docs/` may be synced to GitBook.  
`src/content/blog/` stays exclusively on `https://www.techtips.fun/blog`.

## Recommended: GitHub sync

1. Create a separate GitHub repo for docs (e.g., `saonbd1/techtips-docs`).
2. Copy **only** the contents of this `docs/` folder into that repo.
3. In GitBook: **Space → Sync with GitHub** → connect that repo.
4. GitBook auto-publishes on every push.

## Manual import (one-time)

1. Create a space in GitBook.
2. Import Markdown files from this `docs/` folder only.
3. Edit going forward in GitBook's editor.

## Safety check before every publish

```powershell
node scripts/check-docs-duplication.mjs
```

If it returns any error, fix the conflict before pushing to GitHub/GitBook.

## Cross-linking

- From your Astro blog, add a nav link to your GitBook URL.
- From GitBook, add a link back to `https://www.techtips.fun/blog`.
- Do **not** copy blog posts into GitBook under any circumstances.
