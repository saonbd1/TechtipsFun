---
title: Project Overview
description: How TechTips.fun is structured, how content moves from draft to live, and the automated workflows that keep it running.
category: Documentation
---

# Project Overview

This page is the GitBook-side guide to the TechTips.fun project: what runs where, how an article travels from idea to published post, and which automated jobs handle the rest. The repository-facing README — feature list, full file tree, and quick command reference — lives on [GitHub](https://github.com/saonbd1/TechtipsFun).

## The platform in one paragraph

The site is an Astro project compiled to static files and served from Cloudflare Workers as static assets. There is no application server and no database: every page, image, and feed is a file produced by the build. All dynamic behaviour — scheduled publishing, social promotion, indexing pings — is carried out by GitHub Actions jobs running against the repository.

## Where things live

| Concern | Location |
| :--- | :--- |
| Published articles | `src/content/blog/` |
| Scheduled drafts awaiting their date | `pending-posts/` (ordered by `.order`) |
| Project documentation (this site) | `docs/` |
| Images and fonts served by the site | `public/` |
| Build and promotion scripts | `scripts/` |
| Short-video generator (Remotion) | `reels/` |
| Generated vertical videos | `article-reels/` |

Only the contents of `docs/` are mirrored here on GitBook — see [Publishing Project Docs](publishing.md) for the sync rules.

## From draft to reader

1. **Write** — an article is authored as Markdown with frontmatter (title, description, date, category) and dropped into the blog folder, or parked in the queue with a future publish date.
2. **Schedule** — on its date, the scheduler workflow moves the queued file into the blog folder and commits it.
3. **Build and deploy** — pushing to `main` runs the full build (social cards, image compression, Astro compile, card validation), after which Cloudflare picks up the new `dist/` output.
4. **Promote** — downstream jobs then cross-post the article to LinkedIn, render its vertical reel, submit the URL to IndexNow, and optionally push the reel to YouTube.

The content admin dashboard at `/admin/` performs the first two steps from the browser, committing straight to the repository — details are in the [admin guide](https://github.com/saonbd1/TechtipsFun/blob/main/public/admin/README.md).

## Working on the project

Requires Node.js 22 or newer.

| Task | Command |
| :--- | :--- |
| Install dependencies | `npm install` |
| Live-reload development server | `npm run dev` |
| Production build | `npm run build` |
| Serve the built site locally | `npm run preview` |
| Deploy to Cloudflare | `npm run deploy` |

## Quality gates

Several checks guard the content and the build:

- `node scripts/check-docs-duplication.mjs` — fails if any file in `docs/` collides with a blog post; run it before syncing this site.
- `npm run test:admin` — unit and smoke tests for the admin dashboard.
- `npm run check:links` — crawls for broken outbound links.
- `npm run check` — full build plus TypeScript and a Wrangler dry run.

## Generated media

- **Social preview cards** — a 1200×630 PNG per article is regenerated automatically as part of the production build and published under `/og/`.
- **Vertical reels** — the `reels/` toolchain turns any article into a 1080×1920 clip with animated code blocks and captions; finished clips land in `article-reels/`.

## Further reading

- [Publishing Project Docs](publishing.md) — how this GitBook site stays in sync with the repository
- [Repository README](https://github.com/saonbd1/TechtipsFun) — features, file tree, and the full command list
- [Blog](https://www.techtips.fun/blog) — the published articles themselves
