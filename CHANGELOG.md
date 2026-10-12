# Changelog — techtips.fun (Astro blog starter template)

Custom features and changes on top of the upstream `astro-blog-starter-template`.

## [Unreleased]
### Added
- **Bengali text cleaner** — `scripts/clean_text_to_csv.py` strips scraped-page noise (inline `[1] (https://…)` citations, bare URLs, bullet glyphs, BOM/zero-width characters, dangling separators) from a text file and writes the surviving bullet tips to CSV (`category,title,tip`). Bengali-only by default, `--all-lines` / `--no-bengali-filter` to widen. 12 unit tests in `scripts/tests/`.
- **Tip card generator** — `scripts/generate-tip-cards.mjs` (`npm run cards:tips`) reuses the OG image pipeline (SVG → sharp → PNG) from `generate-social-assets.mjs`, but reads its text from the cleaned CSV rows instead of post frontmatter. Two templates: `photo` (1080x1080, full-bleed photo background with a brand scrim, category chip, headline and tip) and `og` (the classic 1200x630 grid card). Bundled Noto Sans Bengali + Noto Sans in `scripts/assets/fonts/` are registered through a generated fontconfig file, so Bengali glyphs render on machines with no Bengali font installed. `--photo` / `--photo-dir` set the imagery, `--limit` / `--filter` select rows, `--captions` writes ready-to-post captions alongside the PNGs.

## [2026-10-04]
### Added
- **Link checker** — `scripts/check-links.mjs` (`npm run check:links`) extracts every external and internal link from `src/content/blog/` and `pending-posts/`, follows external redirect chains hop by hop (301/302/303/307/308) so the *reason* for each redirect is visible, and validates internal `/blog/<slug>/` links against the real post files (warning when the trailing slash is missing). Requests mimic a browser (User-Agent + `Accept-Language`) so locale hops and WAF blocks don't false-positive. Severities: `ok`, `redirect` (benign chain), `login_wall` (auth-gated, e.g. Google Console), `blocked` (401/403 WAF — needs human review), `dead` (DNS/timeout/TLS), `broken` (404/410), `server_error`, `redirect_loop`. `--fail-on=dead|redirect|all|none`, `--json` for machine-readable reports, transient-error retries built in.
- **Link check in CI** — `.github/workflows/check-links.yml` runs the checker on every push/PR to `main` and fails the build on dead/broken links, so future posts cannot ship with unreachable references.

### Fixed
- **Microsoft activation link pointed at a 2-hop redirector** — the OneDrive article linked `support.microsoft.com/en-us/help/12440`, which 301-hops twice before landing on the real page; it now links the final canonical URL `support.microsoft.com/en-us/windows/activation/activate-windows` (verified 200, zero redirects).
- **LinkedIn Developer Portal link** — the OAuth-client article linked `linkedin.com/developers/` (which redirects); it now links `developer.linkedin.com/` directly (verified 200).

### Link-audit findings (2026-10-04, 40 unique external links)
- 33 ok · 5 benign redirects · 1 WAF-blocked (W3C ARIA disclosure-navigation example — 403 to datacenter IPs, serves real content to browsers; link kept) · 1 login-walled (Google Console API library).
- Redirect reasons identified: Google locale negotiation (`?hl=` appended when `Accept-Language` is absent), Microsoft URL consolidation + locale normalisation (`/microsoft-365/` → `/en/microsoft-365/`), Google Console auth bounce, and the GitHub release-asset redirector (ollama `latest` → versioned → signed CDN URL — expected for "latest" download links).
- The dead Thesify reference in the AI-tools-for-researchers article was removed the same day (domain no longer resolves); all three remaining references (Georgetown University Library, AnswerThis, Zerve) verified 200.

## [2026-10-04]
### Added
- **LinkedIn cross-posting automation** — `scripts/share-to-linkedin.mjs` composes a short teaser (title + truncated frontmatter `description`, ~250 chars) with the canonical article link and publishes it via the LinkedIn legacy `/v2/shares` API (`LINKEDIN_TOKEN` env var, `openid profile w_member_social` scopes; the owner URN `urn:li:person:{sub}` is resolved dynamically from `/v2/userinfo`). Run with a slug, `--latest`, or `--dry-run`. Wired to `.github/workflows/linkedin-share.yml`, which auto-fires when a new post is added to `src/content/blog/` (i.e., right after the scheduled-publish workflow commits) and also supports manual dispatch. (The newer `/v2/ugcPosts` endpoint rejects `urn:li:person` URNs for apps created under a Company Page, so the legacy endpoint is used instead.)
- **Three LinkedIn articles staged** in `pending-posts/` (publishing one per day at 09:00 UTC from 2026-10-05, in `.order` sequence): `how-to-set-up-linkedin-oauth-client` (sibling to the Google OAuth for Blogger guide — developer app creation, Sign In with LinkedIn + Share on LinkedIn products, `openid profile w_member_social` scopes, token storage, 422/401 troubleshooting, security checklist), `automate-linkedin-posts-github-actions` (the expanded merge of three thinner drafts: pipeline diagram, free-pricing breakdown, the full 422/URN trap, frontmatter-driven teasers, OG thumbnails, tools, FAQ), and `netlify-vs-vercel-what-my-emails-revealed-after-using-both` (first-person hosting comparison built on the author's real Gmail evidence: Netlify credit warnings + project suspension vs Vercel operational emails; comparison table, pros/cons, FAQ, linked sources). All three ship branded 1200×630 OG cards in `public/og/` (the OAuth and Netlify-vs-Vercel cards use their 2560×1440 cover images in `public/article-media/`).
- **Signed CDN evidence images localized** for the Netlify-vs-Vercel article: the four `private-us-east-1.manuscdn.com` screenshot URLs (signed, expiring 2026-12-01) were downloaded to `public/article-media/` and rewritten to local paths, so the article's email-screenshot evidence survives past the signature expiry.

### Fixed
- **Internal links missing the trailing slash** — 21 cross-links across 5 published Windows 11 articles (`how-to-fix-windows-11-stuck-on-getting-updates-loop`, `windows-11-battery-drains-fast`, `windows-11-no-sound-after-update`, `windows-11-taskbar-start-menu-not-showing`, `windows-11-wifi-keeps-disconnecting`) pointed at `/blog/<slug>` without the trailing slash. The Worker serves directory-style URLs and answers the no-slash form with a `307 Temporary Redirect`, so every click took a redirect detour. All links now use `/blog/<slug>/`. `schedule-posts.yml` also normalises `/blog/` links in each staged article at publish time, so future scheduled posts ship with the slash even when the source markdown omits it.
- **Scheduled publishes never fired the LinkedIn teaser** — the first scheduled run (2026-10-04 14:32 UTC) published `how-to-set-up-linkedin-oauth-client.md`, but the push event did not trigger `linkedin-share.yml`: the scheduler pushes with the automatic `GITHUB_TOKEN`, and GitHub does not start workflow runs for pushes made with it (verified in the run history — only the manually-pushed commit triggered the share workflow). The scheduler now posts the teaser itself in a "Share the new post to LinkedIn" step right after pushing, so the chain no longer depends on the push trigger. `linkedin-share.yml` remains for manual dispatch and ordinary pushes.

## Custom features

### Branded OG social cards (OG image generation)
- `scripts/generate-social-assets.mjs` renders one branded **1200×630 PNG** per post into `public/og/{slug}.png` using `sharp` + inline SVG: dark card, TECHTIPS.FUN wordmark, the exact post title (word-wrapped), the post's `heroImage` as a circular featured visual (attention-centre-cropped), and the author portrait from `public/portrait.webp` with the "SaonBD / SEO · AI · Open source · Web3" identity row.
- The same script losslessly re-compresses every public raster asset (PNG/JPEG/WebP) when a smaller encoding is available.
- `npm run generate:assets` regenerates all cards; `npm run build` runs it automatically first.
- `src/pages/blog/[...slug].astro` passes `socialImage: /og/{slug}.png` into `BaseHead`, which emits `og:image`, `og:image:type/width/height`, `twitter:image`, `og:type=article`, canonical URL, and article timestamps. Documented in SOCIAL_CARDS.md.

### Image pipeline
- `scripts/migrate-images-to-webp.mjs` — converts legacy raster images to WebP and rewrites references in content.

### Scheduled publishing
- `pending-posts/` staging queue with `pending-posts/.order` (first line publishes first).
- `.github/workflows/schedule-posts.yml` publishes one pending post per day at 09:00 UTC (or on demand via workflow_dispatch): moves the article into `src/content/blog/`, stamps `pubDate` with the publish day, normalises internal `/blog/` links to directory-style URLs, moves the staged OG card into `public/og/`, commits and pushes — the Cloudflare Git integration then deploys — waits 60s for the deploy, and finally posts the LinkedIn teaser directly via `scripts/share-to-linkedin.mjs` (the push itself uses `GITHUB_TOKEN`, which does not trigger other workflows).

### Hosting & site
- Astro 7 on Cloudflare Workers (`@astrojs/cloudflare`, `wrangler`); sitemap and RSS enabled.
- Blog content collection (`src/content.config.ts`) with schema-validated frontmatter: `title`, `description`, `pubDate`, `updatedDate`, `heroImage`, `category`, `tags`.
