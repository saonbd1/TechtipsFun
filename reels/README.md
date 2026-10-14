# TechTips.fun — Article → Reel generator

Turns a Markdown article from `../src/content/blog` into a **vertical 1080x1920
reel** (MP4) built with [Remotion](https://www.remotion.dev/):

- **Animated code** via [Code Hike](https://codehike.org/) — snippets fade/morph in
  with real token transitions, syntax-highlighted from the article's fenced blocks.
- **TikTok-style captions** — 3-4 words at a time, with the current word highlighted
  in brand lime.
- **The article's own images** — the cover (`heroImage`) opens the reel and each
  section's first screenshot (`![alt](src)` or `<img>`) is shown in a window card
  next to its heading. Tall screenshots scroll top-to-bottom instead of shrinking.
- **Reading-speed pacing** — every scene lasts as long as its captions take to
  read (~155 words per minute), so typical reels run 60-90 seconds.
- **Branded scenes** — title hook → key points → code → outro CTA, styled with the
  same palette as the site's OG cards.

Everything is driven by the article's own Markdown, so there is no second source of
truth: edit the post, re-render, done.

## Requirements

- **Node.js 18+** (this repo targets 22+). Uses `fs.statfsSync`, so Node < 18.15 won't work.
- Network access on first run (Google Fonts + Remotion's Chrome Headless Shell download).

```bash
cd reels
npm install
```

## Quick start

```bash
npm run props -- --list                       # every article slug
npm run props -- --latest                     # build props for the newest post
npm run reel  -- --latest                     # render out/<slug>.mp4
npm run reel  -- --slug 10-linux-terminal-commands-i-use-every
npm run reel:all                              # render every article
npm run still -- --slug <slug> --frame 210    # a single PNG poster
npm run dev                                   # Remotion Studio (run `npm run props -- --latest` first so its images are staged)
```

`npm run reel` always rebuilds the props from Markdown first, so one command is
enough. Output lands in `out/`.

To render just a few seconds (handy for a teaser or a quick preview):

```bash
npm run reel -- --slug <slug> --from 0 --duration 8 --out demos/teaser.mp4
```

`demos/8s-demo-linux-terminal.mp4` is an 8-second example produced that way.

### Options

| Flag | Applies to | Meaning |
| --- | --- | --- |
| `--slug <slug>` | props, reel | Which article |
| `--latest` | props, reel | Newest by `pubDate` |
| `--all` | props, reel | Every article |
| `--list` | props | Print slugs |
| `--theme <name>` | props, reel | Code Hike theme (default `github-dark`) |
| `--still` | reel | Render a PNG instead of MP4 |
| `--frame <n>` | reel | Frame for `--still` |
| `--out <path>` | reel | Explicit output path |
| `--from <sec>` | reel | Start the clip at this offset |
| `--duration <sec>` | reel | Render only this many seconds (e.g. a teaser) |
| `--concurrency <n>` | reel | Parallel render tabs |

## The GUI (Reel Studio)

```bash
cd reels
npm run gui          # then open http://localhost:4317
```

Paste an article's Markdown, choose a code theme and a max length, then:

- **Generate reel** - renders the MP4 in a real browser, plays it back in the page
  and offers a download.
- **Preview a frame** - renders a single PNG at ~40% of the timeline (much faster).

While you type (or when you pick a post from the dropdown) the right panel shows
what will be rendered: the scene breakdown (title - points - code - outro) with
per-scene durations, the total length and the caption word count.

Notes:

- Renders are queued and run **one at a time**, so a small host never runs two
  Chromes at once.
- The GUI and the CLI share the same code path (`scripts/build-reel-props.mjs`
  plus the Remotion CLI), so anything the CLI can do the GUI can do too.
- Markdown **without frontmatter works**: the first `# H1` becomes the title and
  the first paragraph the description.
- Characters outside the reel's font subset (emoji, `→ ...`) are replaced with
  spaces and reported in the UI, because Chromium's font fallback crashes the
  renderer in a fontless container.
- Deep link: `http://localhost:4317/?slug=<slug>` preloads a post.
- Scratch space lives in `server/work/` (gitignored).

### REST API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/meta` | themes + defaults |
| `GET /api/posts` / `GET /api/posts/:slug` | list posts / fetch one as Markdown |
| `POST /api/inspect` | `{markdown, theme?, maxSeconds?}` -> scene plan, no render |
| `POST /api/still` | `{markdown, at?}` -> `{jobId}` for a poster PNG |
| `POST /api/render` | `{markdown, clipSeconds?}` -> `{jobId}` for an MP4 |
| `GET /api/jobs/:id` | status, `percent`, `label`, `fileUrl` |
| `GET /api/files/:id` | the rendered file |

## How it works

```
src/content/blog/<slug>.md
        |
        |  scripts/build-reel-props.mjs   (Node)
        |    - parse frontmatter + ## sections + fenced code + images
        |    - stage images into public/post-media/<slug>/ (scripts/lib/post-media.mjs)
        |    - plan scenes; durations come from reading speed
        |    - highlight code with Code Hike (@code-hike/lighter)
        |    - synthesise a word-level caption track
        v
src/generated/<slug>.json  (fully-baked props)  ->  also written to latest.json
        |
        |  npx remotion render Reel out/<slug>.mp4 --props=...
        v
out/<slug>.mp4   (1080x1920, 30fps, H.264)
```

Highlighting happens in **Node, at build time**, so the composition is a pure
function of its props - no filesystem or network reads while rendering, and the
same props file always produces the same video.

### File map

| Path | Role |
| --- | --- |
| `scripts/build-reel-props.mjs` | Article → props (parsing, scenes, captions, highlighting) |
| `scripts/render-reel.mjs` | Build props + call the Remotion CLI |
| `scripts/lib/post-media.mjs` | Finds the post's images, trims/resizes them into `public/post-media/` |
| `src/components/ScreenshotCard.tsx` | Window-style card for article images (fit or scroll) |
| `scripts/glyph-audit.mjs` | Warns about glyphs that can crash the renderer |
| `src/Root.tsx` | Registers the `Reel` composition |
| `src/Reel.tsx` | Scene timeline, background, top bar, captions, progress bar |
| `src/scenes/*` | Title / point / code / outro scenes |
| `src/code/*` | Code Hike token-transition animation |
| `src/captions/CaptionOverlay.tsx` | TikTok-style pagination + word highlight |
| `src/schema.ts` | Props contract (zod, also powers the Studio props editor) |
| `src/brand.ts` | Brand tokens, reel size, safe area |
| `server/index.mjs` | Reel Studio: static UI + render job queue |
| `server/public/*` | The GUI itself (plain HTML/CSS/JS, no build step) |
| `scripts/lib/remotion-cli.mjs` | Shared Remotion CLI spawn + progress parsing |

## Customising

- **Brand / sizes** — `src/brand.ts` (`BRAND`, `REEL`, `SAFE_AREA`).
- **Pacing** — the `PACE` object at the top of `build-reel-props.mjs`.
  `WORDS_PER_SECOND` is the main dial (2.6 ≈ 155 wpm; lower = slower reel).
  Each scene type has a `min`/`max` length in seconds, `IMAGE_BONUS` adds time
  to look at a screenshot, and `codeStep` sets time per code line. Overall
  length is capped by `DEFAULT_MAX_SECONDS` (90, or `--max-seconds`) and
  `MAX_SECTIONS`.
- **Caption cadence** — `MAX_WORDS_PER_CAPTION_PAGE` (4) in the builder decides how
  many words are on screen at once.
- **Images** — `scripts/lib/post-media.mjs`. Placeholders (`blog-placeholder*`)
  and images smaller than 320px are skipped; a missing or broken image is
  skipped with a warning, never failing the render. Only one image per section
  is used, and sections with code show the code instead.
- **Code look** — `src/fonts.ts` (`codeFontSize`, `codeTabSize`) and the theme
  passed to the builder. The font size auto-shrinks to fit the longest line.
- **Scene selection** — `buildScenes()` decides which sections become code scenes
  vs. text scenes. Sections with fenced code become code scenes.

Sections whose code fence has no language are highlighted as plain text; snippets
are capped at `MAX_CODE_LINES` lines each.

## Adding a voiceover (optional)

Captions are currently *synthesised* from the on-screen script with even timings,
which is why the reel works without audio. To drive them from real speech instead:

1. Generate a voiceover and drop it in `public/` as `<slug>.mp3`.
2. Transcribe it with `@remotion/install-whisper-cpp` + `@remotion/captions`
   (see the official [`--tiktok` template](https://www.remotion.dev/templates/tiktok))
   into `public/<slug>.json`.
3. Swap the `captions` array in `build-reel-props.mjs` for that transcription and
   add the audio with `<Audio src={staticFile(...)} />` in `src/Reel.tsx`.

The `CaptionPage` component already consumes word-level `fromMs`/`toMs` timings,
so nothing else has to change.

## Rendering in bulk / CI

`npm run reel:all` renders every article sequentially. For serious volume, render
on [Remotion Lambda](https://www.remotion.dev/docs/lambda) or your own workers -
the props files are the only input you need to ship.

### Running headless on Linux

Rendering needs Chromium plus its system libraries. Two environment notes worth
knowing, both discovered the hard way while building this:

1. **Missing shared libraries.** Chrome Headless Shell needs `libnss3` / `libnspr4`.
   On a normal box install `libnss3 libnspr4` (or run Remotion's `apt-get` block
   from the docs). Without root you can fetch the `.deb`s, extract them and point
   `LD_LIBRARY_PATH` at them:

   ```bash
   mkdir -p /tmp/chromedeps && cd /tmp/chromedeps
   curl -sO https://deb.debian.org/debian/pool/main/n/nss/libnss3_3.87.1-1+deb12u2_amd64.deb
   curl -sO https://deb.debian.org/debian/pool/main/n/nspr/libnspr4_4.35-1_amd64.deb
   for d in *.deb; do dpkg-deb -x "$d" ./root; done
   export LD_LIBRARY_PATH="$PWD/root/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH"
   ```

2. **Tiny `/dev/shm`.** Remotion keeps an ~8 MB shared-memory pool per concurrent
   tab. Containers often mount only 64 MB of `/dev/shm`, so Chrome dies mid-render
   with `Target closed`. `scripts/render-reel.mjs` detects this and sets
   `REMOTION_SHARED_MEMORY_BACKEND=file` automatically (you can set it yourself, or
   pass `--concurrency 4`).

## Pitfalls

- **Avoid glyphs outside the loaded font subset.** We only load the `latin`
  Google Fonts subset. `\u2192` (`→`) is *not* in it, and Chromium's font fallback
  hard-crashed the renderer here (`Target closed`) until the arrow was replaced with
  inline SVG. `scripts/glyph-audit.mjs` now warns on every build; prefer ASCII or SVG
  for symbols.
- **`remotion.config.ts` is compiled to CommonJS** — `import.meta` is not available
  there. Resolve modules via `createRequire(process.cwd() + "/package.json")`.
- **`codehike`'s `<Pre />` does not apply `code.style`.** Pass the text colour
  explicitly (see `src/code/CodeTransition.tsx`) or the code renders in the default
  (black-on-dark) colour.
- **`createTikTokStyleCaptions` only breaks pages when a token starts with a
  space.** The builder prefixes every word with one, Whisper-style, and sets
  `pageBreakAfter` on the last word of each scene.

## Licensing

Remotion is free for individuals and companies of up to 3 people; larger
organisations need a [Company License](https://www.remotion.dev/pricing). Check
that before shipping this in a company.
