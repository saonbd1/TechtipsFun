# TechTips.fun Docs — Project Documentation Only

This folder contains **project documentation only** for GitBook.

## 🔒 Strict rule: No blog posts on GitBook

| ✅ Allowed in `docs/` (→ GitBook) | ❌ Blocked from `docs/` (stays on Astro blog) |
| :--- | :--- |
| Project setup guides | Dated blog posts |
| API / tool reference | News and link roundups |
| Tutorials & SOPs | Opinion pieces |
| Troubleshooting docs | "How I fixed X" stories |
| Changelogs | Time-sensitive announcements |

**A topic lives in exactly one place.**  
If you write a blog post, it goes in `src/content/blog/` only.  
If you write a project doc, it goes in `docs/` only.  
Never publish the same Markdown to both.

## Adding a new project doc

```powershell
New-Item "docs/my-project-guide.md" -ItemType File
```

Add frontmatter:

```md
---
title: My Project Guide
description: One-line summary
category: Documentation
---
```

## Before publishing to GitBook

Run the guard script — it will **fail** if any file in `docs/` looks like a blog post:

```powershell
node scripts/check-docs-duplication.mjs
```

Only push `docs/` to GitBook once the script passes.

## Publishing

See [`PUBLISHING.md`](PUBLISHING.md) for GitBook sync steps.
