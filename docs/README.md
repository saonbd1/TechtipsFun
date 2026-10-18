# TechTips.fun Docs

Documentation and reference guides for TechTips.fun.

## Purpose

This folder contains **evergreen documentation only** — tutorials, reference guides, and troubleshooting docs that don't expire.

Blog posts (time-based, opinion, news) live in `src/content/blog/` instead.

## Separation rule (never break this)

| Location | Content type | Example |
| :--- | :--- | :--- |
| `src/content/blog/` | Dated posts, news, link roundups, opinions | `how-to-fix-windows-11-sound.md` |
| `docs/` | Timeless reference, tutorials, SOPs | `windows-sound-troubleshooting.md` |

**A topic must exist in exactly one place.** If you move a blog post into docs, delete or canonicalize the blog version. Never publish the same Markdown to both.

## Adding a new doc

1. Create a Markdown file in `docs/`:
   ```powershell
   New-Item "docs/my-guide.md" -ItemType File
   ```
2. Add frontmatter:
   ```md
   ---
   title: My Guide Title
   description: One-line summary
   category: Reference
   ---
   ```
3. Push to GitHub and sync to GitBook (see [`PUBLISHING.md`](PUBLISHING.md)).

## Checking for duplication

Run the guard script before publishing:

```powershell
node scripts/check-docs-duplication.mjs
```

It will fail if any doc title or slug overlaps with a published blog post.
