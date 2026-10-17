# Content admin

A private AdminLTE 4 dashboard for writing posts and managing the publish queue.
It ships as static files inside this Astro build and is served at
`https://www.techtips.fun/admin/`.

## Why there is no server

This site is a static Astro build deployed to Cloudflare Workers static assets.
There is no backend to write posts to, so the dashboard talks **straight to the
GitHub Contents API** with a fine-grained token that the operator pastes in.
Every save is an ordinary commit on the configured branch — which means the
existing Cloudflare auto-deploy, `schedule-posts.yml`, `linkedin-share.yml`,
`article-reels.yml` and `submit-indexnow.yml` pipelines keep working exactly as
before, untouched.

## What it does

| Page | What it is for |
| --- | --- |
| **Dashboard** | Counts (published posts, queue length, categories, media), the newest posts, and the publish pipeline explained |
| **Posts** | Search/filter `src/content/blog/`, edit frontmatter + Markdown with a live preview, create a post, delete a post |
| **Queue** | Read and reorder `pending-posts/.order`, create a queued draft (which is appended to `.order`), remove or delete a draft |
| **Media** | Browse and upload `public/article-media/` (plus a read-only view of `public/og/`), copy public paths, delete files |
| **Settings** | Repository/branch, sign out, how to create a token |

Everything else — rendering reels, posting to LinkedIn, submitting to IndexNow —
stays in GitHub Actions. The dashboard only links to those.

## Signing in

1. Create a **fine-grained personal access token**:
   <https://github.com/settings/personal-access-tokens/new>
2. **Repository access** → only `saonbd1/astro-blog-starter-template`.
3. **Permissions → Repository permissions → Contents** → *Read and write*.
   Nothing else is required (the dashboard never dispatches workflows, so it
   does not need `Actions` or `Workflows`).
4. Set a short expiry.
5. Paste it into the sign-in gate.

The token is held in `sessionStorage` (this tab only) unless you tick
*remember*, in which case it goes to `localStorage`. It is sent only to
`api.github.com` — the page has no other network destination, enforced by the
CSP in `public/_headers`.

> A token in a browser is a real credential. Use the narrowest scope and a short
> expiry, and leave *remember* off on a shared machine. Sign out from **Settings**
> to clear it.

## Content rules it enforces

The frontmatter form mirrors the Zod schema in `src/content.config.ts`:
`title`, `description`, `pubDate`, `category` are required; `heroImage`,
`updatedDate` and `tags` are optional. Dates are written in the site's
`Jul 17 2026` shape — the same format `schedule-posts.yml` stamps with
`date +"%b %d %Y"` — and `z.coerce.date()` parses them.

Two deliberate safety properties:

- **Unknown frontmatter keys are preserved.** If a post carries a key the schema
  does not know, editing it in the dashboard writes that key back verbatim
  rather than dropping it.
- **The Markdown body is saved verbatim.** Only the frontmatter block is
  regenerated, so the article text is never reformatted.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | AdminLTE shell (sidebar, header, sign-in gate, confirm dialog) |
| `app.js` | The whole application: GitHub client, views, editor, Markdown preview |
| `styles.css` | The small set of styles specific to this tool |
| `vendor/adminlte/` | AdminLTE 4.10.0 `adminlte.min.css` + `adminlte.min.js` |
| `vendor/bootstrap/` | Bootstrap 5.3.8 `bootstrap.bundle.min.js` (a peer dependency AdminLTE does not bundle) |
| `vendor/bootstrap-icons/` | Bootstrap Icons 1.13.2 CSS + fonts |

The assets are vendored rather than loaded from a CDN so the page works offline
and the CSP can stay closed (`script-src 'self'`).

## Tests

Two test files, both run by `npm run test:admin` (Node's built-in test runner —
no dependencies, no build step, no browser):

| File | What it covers |
| --- | --- |
| `scripts/tests/test-admin-app.mjs` | The pure logic: frontmatter parse/build (including that unknown keys survive a round trip), date helpers, `slugify`, validation, the Markdown preview and its HTML escaping, and the `.order` walk. It also statically checks that every identifier `app.js` calls is actually defined — a check that caught a real bug (`attr()` was called 44 times before it existed). |
| `scripts/tests/test-admin-smoke.mjs` | The UI actually running. It builds a stub DOM, mocks `fetch` with canned GitHub API responses, boots `app.js`, then signs in and opens every page, the editor, and saves a post and a queued draft — asserting the requests and the committed payload. |

```bash
npm run test:admin
```

The unit test loads `app.js`, swaps the browser boot block for an export of the
internals, and evaluates it in a `node:vm` sandbox.

## Adding a page

Views are plain functions returning HTML strings (`renderPosts`,
`renderQueue`, …) dispatched from `route()` by the hash route
(`#/posts`, `#/queue/edit/<encoded path>`). Add the sidebar entry in
`index.html` (with a `data-nav` attribute) and a `case` in `route()`.

## Deployment note

Only the compiled assets belong in production — which is exactly what this is:
`public/admin/` is copied verbatim into `dist/admin/` by the Astro build. There
is no `node_modules` or source directory to leak.
