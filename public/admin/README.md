# Content admin

A private AdminLTE 4 dashboard for writing posts and managing the publish queue.
It ships as static files inside this Astro build and is served at
`https://www.techtips.fun/admin/`.

## Two sign-in modes

| Mode | When | Credential |
| --- | --- | --- |
| **GitHub OAuth** (production) | `worker/index.js` is deployed and `/admin` is gated by it | none in the browser — an `HttpOnly` session cookie; the Worker holds the fine-grained PAT |
| **Pasted token** (fallback) | no Worker in front of the assets (`astro dev`, a plain static server) | fine-grained PAT in `sessionStorage`/`localStorage`, sent straight to `api.github.com` |

Both modes commit to GitHub the same way — every save is an ordinary commit on
the configured branch — so the existing Cloudflare auto-deploy,
`schedule-posts.yml`, `linkedin-share.yml`, `article-reels.yml` and
`submit-indexnow.yml` pipelines keep working exactly as before.

The Worker only runs for `/admin` and `/admin/*` (`assets.run_worker_first` in
`wrangler.json`); every other request still goes straight to the static assets,
so the blog's traffic path is unchanged.

## How OAuth mode works

```
browser ──GET /admin/──▶ Worker: no session cookie? ──302──▶ /admin/auth/login
                                     │                              │
                          valid session cookie              302 ▶ github.com/login/oauth/authorize
                                     ▼                              │
                          env.ASSETS.fetch()              /admin/auth/callback?code&state
                                                                    │  verify state cookie
                                                                    │  POST /login/oauth/access_token
                                                                    │  GET /user → allowlist check
                                                                    ▼
                                        Set-Cookie: ttadmin_session (HttpOnly)
                                                    ttadmin_mode=oauth (readable)
```

- `ttadmin_session` is `{login,id,name,avatar,exp}` signed with HMAC-SHA256
  (`SESSION_SECRET`), 8 hour TTL, `HttpOnly; Secure; SameSite=Lax; Path=/admin`.
  Tampering with any byte invalidates it.
- `ttadmin_mode=oauth` is readable on purpose: `app.js` uses it to pick OAuth
  mode over the token gate. Its absence is what keeps the fallback working.
- `app.js` then calls `/admin/api/github/<path>` instead of
  `https://api.github.com/<path>`. The Worker attaches `GITHUB_TOKEN`, drops the
  caller's own `Authorization`/`Cookie`, and refuses any path outside
  `ADMIN_REPO`.
- Signing out hits `/admin/auth/logout`, which clears both cookies and lands on
  the public site (not `/admin/auth/login`, which GitHub would silently
  re-approve).

## Setting it up

1. **OAuth App** — <https://github.com/settings/developers> → *New OAuth App*:
   - Homepage URL: `https://www.techtips.fun`
   - Authorization callback URL: `https://www.techtips.fun/admin/auth/callback`
     (add `http://localhost:8787/admin/auth/callback` for `wrangler dev`)
2. **Fine-grained PAT** — <https://github.com/settings/personal-access-tokens/new>,
   repository access only `saonbd1/TechtipsFun`, **Contents: Read and write**.
   Nothing else (the dashboard never dispatches workflows).
3. **Worker secrets** (production):
   ```bash
   npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
   npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET        # 32+ random bytes
   npx wrangler secret put GITHUB_TOKEN          # the PAT from step 2
   npx wrangler secret put ADMIN_GITHUB_LOGINS   # e.g. saonbd1
   # optional: ADMIN_GITHUB_IDS, and ADMIN_REPO is a plain var in wrangler.json
   ```
   `ADMIN_GITHUB_LOGINS` is required — with no allowlist the Worker refuses to
   sign anyone in rather than defaulting to open.
4. **Deploy** — `npm run deploy`. Local: copy `.dev.vars.example` to `.dev.vars`
   and run `npm run preview` (`astro dev` has no Worker, so it uses the token
   gate).

`GITHUB_OAUTH_*` and `SESSION_SECRET` missing → `/admin/auth/login` answers 503
and names the missing variables instead of failing with a stack trace.

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

## Fallback sign-in (no Worker)

Used by `astro dev` and any static preview. Create a **fine-grained token**:

1. <https://github.com/settings/personal-access-tokens/new>
2. **Repository access** → only `saonbd1/TechtipsFun`.
3. **Permissions → Repository permissions → Contents** → *Read and write*.
   Nothing else is required (the dashboard never dispatches workflows, so it
   does not need `Actions` or `Workflows`).
4. Set a short expiry.
5. Paste it into the sign-in gate.

The token is held in `sessionStorage` (this tab only) unless you tick
*remember*, in which case it goes to `localStorage`. It is sent only to
`api.github.com` — enforced by the CSP in `public/_headers`.

> A token in a browser is a real credential. Use the narrowest scope and a short
> expiry, and leave *remember* off on a shared machine. In OAuth mode there is no
> browser credential at all.

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
| `../../worker/index.js` | GitHub OAuth gate, session cookie and the `/admin/api/github` write proxy |
| `index.html` | AdminLTE shell (sidebar, header, sign-in gate for both modes, confirm dialog) |
| `app.js` | The whole application: GitHub client, views, editor, Markdown preview |
| `styles.css` | The small set of styles specific to this tool |
| `vendor/adminlte/` | AdminLTE 4.10.0 `adminlte.min.css` + `adminlte.min.js` |
| `vendor/bootstrap/` | Bootstrap 5.3.8 `bootstrap.bundle.min.js` (a peer dependency AdminLTE does not bundle) |
| `vendor/bootstrap-icons/` | Bootstrap Icons 1.13.2 CSS + fonts |

The assets are vendored rather than loaded from a CDN so the page works offline
and the CSP can stay closed (`script-src 'self'`).

## Tests

Three test files, all run by `npm run test:admin` (Node's built-in test runner —
no dependencies, no build step, no browser):

| File | What it covers |
| --- | --- |
| `scripts/tests/test-admin-app.mjs` | The pure logic: frontmatter parse/build (including that unknown keys survive a round trip), date helpers, `slugify`, validation, the Markdown preview and its HTML escaping, and the `.order` walk. It also statically checks that every identifier `app.js` calls is actually defined — a check that caught a real bug (`attr()` was called 44 times before it existed). |
| `scripts/tests/test-admin-worker.mjs` | The Worker: unauthenticated `/admin` redirects instead of serving assets, the OAuth redirect carries client id/callback/state, the state cookie is `HttpOnly`+`SameSite`, the allowlist (login or numeric id) is enforced, `next` cannot become an open redirect, the session cookie is refused when tampered with or swapped onto another payload, the proxy only reaches `ADMIN_REPO` and swaps the browser credential for the Worker PAT, and missing secrets answer 503 naming the variable. |
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
