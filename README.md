# TechTips.fun — Personal Tech Blog & Knowledge Base

A personal tech blog and knowledge base built with [Astro](https://astro.build), deployed as a static site to [Cloudflare Workers](https://developers.cloudflare.com/workers/). Covers Windows troubleshooting, AI tools, web development, productivity, and developer tooling.

**Live site:** https://www.techtips.fun

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Writing & Managing Content](#writing--managing-content)
- [Content Admin Dashboard](#content-admin-dashboard)
- [Article Reels (Auto Video Generation)](#article-reels-auto-video-generation)
- [Social Sharing Cards (OG Images)](#social-sharing-cards-og-images)
- [CI/CD Workflows](#cicd-workflows)
- [Scripts & Automation](#scripts--automation)
- [Folder Reference](#folder-reference)
- [Deployment](#deployment)
- [Testing](#testing)
- [License](#license)

---

## Features

- ✍️ **Markdown & MDX blog posts** — write in `src/content/blog/`, frontmatter validated with Zod
- ⚡ **Static output** — built with Astro, deployed to Cloudflare Workers static assets (no server)
- 🔍 **SEO-ready** — canonical URLs, OpenGraph data, sitemap, RSS feed, per-post `og:image` cards
- 🎬 **Article reels** — automatic vertical 1080×1920 MP4 videos generated from each post (Remotion)
- 📱 **Social cards** — branded 1200×630 PNG preview images for every post
- 🤖 **Automated publishing** — scheduled posts, LinkedIn cross-posting, IndexNow submission
- 🛡️ **Private admin dashboard** — write/edit posts and manage the publish queue via a browser (no backend)
- 🧪 **Tested** — admin app unit + smoke tests with Node's built-in test runner

---

## Tech Stack

| Layer | Tool |
| :--- | :--- |
| Framework | [Astro](https://astro.build) (v7) |
| Runtime target | Cloudflare Workers static assets (`@astrojs/cloudflare`) |
| Content | Markdown / MDX with [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/) |
| Styling | Custom CSS (no UI framework) |
| Video | [Remotion](https://www.remotion.dev/) + [Code Hike](https://codehike.org/) |
| Admin UI | AdminLTE 4 + Bootstrap 5 (vendored, no CDN) |
| CI/CD | GitHub Actions |
| Deploy | [Wrangler](https://developers.cloudflare.com/workers/wrangler/) |

**Node:** `>=22` (see `package.json` engines)

---

## Project Structure


```
techtipsfun/
├── README.md                      # this file
├── astro.config.mjs               # Astro + Cloudflare config
├── package.json                   # dependencies & scripts
├── wrangler.json                  # Cloudflare Workers deploy config
├── tsconfig.json
├── .gitignore
├── CHANGELOG.md
├── TODO.md
├── SOCIAL_CARDS.md                # OG image generation docs
│
├── src/                           # Astro source code
│   ├── content/
│   │   ├── blog/                  # Markdown/MDX blog posts (one file per post)
│   │   └── content.config.ts      # Zod schema + collection config
│   ├── components/                # Astro components
│   ├── layouts/                   # Page layouts
│   ├── pages/                     # Routes (/blog, /categories, /tags, /og, ...)
│   ├── styles/                    # Global styles
│   ├── utils/                     # Helpers (post slug, rehype images, etc.)
│   └── data/
│
├── public/                        # Static assets
│   ├── admin/                     # Private content admin dashboard (served at /admin/)
│   ├── article-media/             # Images embedded in posts
│   ├── fonts/                     # Font files
│   ├── og/                        # Generated per-post social cards
│   └── social-cards/
│
├── scripts/                       # Build & automation scripts
│   ├── generate-social-assets.mjs # OG card generation
│   ├── optimize-images.mjs        # Image compression
│   ├── check-links.mjs            # Link rot checker
│   ├── submit-indexnow.mjs        # IndexNow submission
│   ├── share-to-linkedin.mjs      # LinkedIn cross-posting
│   ├── generate-tip-cards.mjs
│   ├── migrate-images-to-webp.mjs
│   └── tests/                     # Admin dashboard tests
│
├── reels/                         # Article → Reel video pipeline (Remotion)
│   ├── ci/                        # GitHub Actions workflows (staged, not yet in .github/)
│   └── ...
│
├── article-reels/                 # Generated MP4 reels (one per published article)
│   └── README.md
│
├── pending-posts/                 # Scheduled post queue (.order + drafts)
│   └── .order
│
├── standalone/                    # Projects meant to be lifted into their own repos
│   └── bengali-tip-cards/
│
├── patches/                       # Git patches applied manually (workflow permission limits)
│   └── README.md
│
└── .github/workflows/             # GitHub Actions CI/CD
    ├── article-reels.yml
    ├── check-links.yml
    ├── linkedin-share.yml
    ├── post-reels-to-youtube.yml
    ├── schedule-posts.yml
    └── submit-indexnow.yml
```

---

## Writing & Managing Content

### Create a new post

Add a Markdown file to `src/content/blog/`:

```
src/content/blog/my-post-slug.md
```

### Frontmatter schema

Each post needs this YAML frontmatter:

```md
---
title: My Post Title
description: Short description for SEO and listings
pubDate: Jul 17 2026
category: Windows
heroImage: /article-media/my-image.webp
tags:
  - windows-11
  - troubleshooting
updatedDate: Jul 18 2026   # optional
---
```

| Field | Required | Notes |
| :--- | :--- | :--- |
| `title` | Yes | Post title |
| `description` | Yes | SEO meta description |
| `pubDate` | Yes | Publication date (`%b %d %Y` format, e.g. `Jul 17 2026`) |
| `category` | Yes | Blog category |
| `heroImage` | No | Root-relative path under `public/` |
| `tags` | No | Array of tags |
| `updatedDate` | No | Last-modified date |

The admin dashboard enforces this same schema (see `src/content.config.ts`).

### Write the body

Everything after the frontmatter `---` is the Markdown/MDX body. Images should live in `public/article-media/` and be referenced as `/article-media/filename.webp`.

### Publish queue

Drafts scheduled for future publishing live in `pending-posts/`. The `schedule-posts.yml` workflow promotes them to `src/content/blog/` on their publish date.

---

## Article Reels (Auto Video Generation)

Each published article can be turned into a **vertical 1080×1920 MP4 reel** automatically. The pipeline lives in `reels/` (Remotion + Code Hike) and outputs to `article-reels/`.

### What it does

- Animated code blocks via Code Hike with real syntax highlighting
- TikTok-style captions (3–4 words at a time, current word highlighted)
- Post cover image (`heroImage`) opens the reel; section screenshots shown in window cards
- Reading-speed pacing (~155 words/minute); typical reels run 60–90 seconds
- Branded title → key points → code → outro scenes

### Triggering

The **Generate article reels** workflow runs automatically when:

- A commit adds a file under `src/content/blog/` (normal push)
- The **Schedule post publishing** workflow finishes (scheduled publishes)

Manual runs are available via **Actions → Generate article reels → Run workflow**:

| Input | Effect |
| :--- | :--- |
| `slug` | Render just that one article |
| `max` | How many missing reels to render (default 5) |
| `force` | Re-render even if a reel already exists |
| `refresh` | How many outdated reels to re-render |

### Render locally

```powershell
cd reels
npm install
npm run reel -- --latest              # newest article
npm run reel -- --slug <slug>         # specific article
npm run reel:all                      # every article
npm run dev                           # Remotion Studio at http://localhost:4317
```

### Full docs

- [`reels/README.md`](reels/README.md) — pipeline, options, GUI, pitfalls, licensing
- [`article-reels/README.md`](article-reels/README.md) — output folder, triggering, local rendering, repo size
- [`reels/ci/README.md`](reels/ci/README.md) — staging the workflows into `.github/workflows/`

> Note: the workflow YAML files live in `reels/ci/` because the generating credential lacks the `workflows` permission to write directly into `.github/workflows/`. Use `git mv reels/ci/<file>.yml .github/workflows/` to install them.




---

## Content Admin Dashboard

There is a private, serverless AdminLTE dashboard at `https://www.techtips.fun/admin/` (static files in `public/admin/`). Because the site is static with no backend, the dashboard writes posts directly to the **GitHub Contents API** using a fine-grained personal access token. Every save is an ordinary commit on `main`, so all existing CI/CD pipelines keep working untouched.

### What it does

| Page | Purpose |
| :--- | :--- |
| Dashboard | Post counts, queue length, newest posts, pipeline status |
| Posts | Search/filter posts, edit frontmatter + Markdown with live preview, create/delete posts |
| Queue | Manage `pending-posts/.order`, create queued drafts, reorder/remove drafts |
| Media | Browse/upload `public/article-media/`, view `public/og/`, copy public paths |
| Settings | Repo/branch config, sign out, token creation help |

### Signing in

1. Create a **fine-grained personal access token**: https://github.com/settings/personal-access-tokens/new
2. **Repository access** → only this repo (`saonbd1/TechtipsFun`)
3. **Permissions → Repository permissions → Contents** → Read and write
4. Set a short expiry, then paste the token into the sign-in gate

> A token in a browser is a real credential. Use the narrowest scope, a short expiry, and leave *remember* off on shared machines.

### Full docs

See [`public/admin/README.md`](public/admin/README.md) for token setup, file structure, content rules, and how to add pages.

### Tests

```powershell
npm run test:admin
```

Runs two test files with Node's built-in test runner (no dependencies, no browser):

- `scripts/tests/test-admin-app.mjs` — frontmatter parse/build, date helpers, slugify, validation, Markdown preview
- `scripts/tests/test-admin-smoke.mjs` — boots `app.js` in a stub DOM and signs in to exercise every page

---

## Getting Started

All commands run from the repo root.

### Install dependencies

```powershell
npm install
```

### Local development

Starts the Astro dev server at `http://localhost:4321`:

```powershell
npm run dev
```

### Build for production

Runs asset generation, image optimization, the Astro build, and OG-card validation:

```powershell
npm run build
```

Output goes to `./dist/`.

### Preview locally

```powershell
npm run preview
```

Builds the site, then serves it locally with Wrangler so you can test exactly as it will run on Cloudflare.

### Deploy

```powershell
npm run deploy
```

Deploys to Cloudflare Workers via Wrangler. Requires a logged-in Wrangler session (`wrangler login`).

### Other useful scripts

| Script | Purpose |
| :--- | :--- |
| `npm run generate:assets` | Regenerate social cards + compress raster assets |
| `npm run optimize:images` | Compress images under `public/` |
| `npm run cards:tips` | Generate Bengali tip-card assets |
| `npm run check:links` | Scan for broken links |
| `npm run check:og-cards` | Validate OG card images |
| `npm run test:admin` | Run admin dashboard unit + smoke tests |
| `npm run astro -- --help` | Show Astro CLI help |
| `npm run cf-typegen` | Generate Wrangler TypeScript types |

---

## Social Sharing Cards (OG Images)

Every post gets a branded **1200×630 PNG** at `/og/{post-id}.png`, used as `og:image` and `twitter:image` for Facebook, X, and other crawlers.

- Uses the post title, featured image, author portrait (`public/portrait.webp`), and canonical URL
- Regenerate with: `npm run generate:assets`
- The production `npm run build` runs this automatically before Astro builds
- Keep `heroImage` as a root-relative path under `public/`

Full details: [`SOCIAL_CARDS.md`](SOCIAL_CARDS.md)

After deploying, use the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) and [X Card Validator](https://cards-dev.twitter.com/validator) to refresh cached previews.

---

## CI/CD Workflows

| Workflow | Purpose |
| :--- | :--- |
| `article-reels.yml` | Generate article reels on new/scheduled posts |
| `check-links.yml` | Weekly link-rot sweep (Mondays 06:00 UTC) |
| `linkedin-share.yml` | Cross-publish new posts to LinkedIn |
| `post-reels-to-youtube.yml` | Upload finished reels to YouTube |
| `schedule-posts.yml` | Promote queued drafts from `pending-posts/` on publish date |
| `submit-indexnow.yml` | Submit URLs to IndexNow |

A copy of `article-reels.yml` and `check-links.yml` (with weekly schedule) is staged in [`reels/ci/`](reels/ci/README.md) pending install into `.github/workflows/`.

---

## Scripts & Automation

| Script | Purpose |
| :--- | :--- |
| `scripts/generate-social-assets.mjs` | Generate per-post OG cards |
| `scripts/optimize-images.mjs` | Compress images in `public/` |
| `scripts/check-links.mjs` | Detect broken links |
| `scripts/submit-indexnow.mjs` | Push URLs to IndexNow |
| `scripts/share-to-linkedin.mjs` | Share new posts to LinkedIn |
| `scripts/generate-tip-cards.mjs` | Generate Bengali tip cards |
| `scripts/migrate-images-to-webp.mjs` | Convert images to WebP |
| `scripts/tests/` | Admin dashboard test suite |

---

## Folder Reference

| Folder | Contents | Docs |
| :--- | :--- | :--- |
| `article-reels/` | Generated MP4 reels (1–3 MB each) | [`README.md`](article-reels/README.md) |
| `patches/` | Git patches applied manually (workflow permission limits) | [`README.md`](patches/README.md) |
| `public/admin/` | Private content admin dashboard | [`README.md`](public/admin/README.md) |
| `reels/` | Remotion video pipeline | [`README.md`](reels/README.md) |
| `reels/ci/` | Staged GitHub Actions workflows | [`README.md`](reels/ci/README.md) |
| `standalone/` | Projects to lift into their own repos | [`README.md`](standalone/README.md) |
| `docs/` | Evergreen documentation (published to GitBook) | [`README.md`](docs/README.md) |
| `pending-posts/` | Scheduled post queue | — |
| `scripts/` | Build & automation scripts | — |

---

## Deployment

The site builds to static HTML and deploys to **Cloudflare Workers static assets** via Wrangler.

```powershell
npm run build      # build locally first to verify
npm run deploy     # push to Cloudflare
```

Build output goes to `./dist/` (git-ignored). `public/admin/` is copied verbatim into `dist/admin/` by the Astro build.

### Mirror on Bitbucket

This repo is mirrored to Bitbucket at `https://bitbucket.org/techtipsfun/techtipsfun` (private). Push all branches and tags with:

```powershell
git push bitbucket --all
git push bitbucket --tags
```

---

## Testing

```powershell
npm run test:admin   # admin dashboard unit + smoke tests
npm run check        # full build + TypeScript + wrangler dry-run
```

---

## License

This is a personal blog repository. The theme draws inspiration from [Bear Blog](https://github.com/HermanMartinus/bearblog/). The Remotion video tooling is free for individuals and companies of up to 3 people; larger organisations need a [Company License](https://www.remotion.dev/pricing).
