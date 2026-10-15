---
title: "Blog post to reel video, self-hosted: render a reel for every article"
description: "Every blog-to-video tool asks for a subscription. Here is the self-hosted alternative: Markdown becomes animated code, real screenshots and captions, rendered on publish. And it is free"
pubDate: "Oct 10 2026"
updatedDate: "Oct 14 2026"
heroImage: "/blog-to-video-pipeline.png"
category: "Automation"
tags: ["Remotion", "Video Automation", "GitHub Actions", "React", "Content Repurposing"]
---

![A generated reel scene: syntax-highlighted code in a terminal panel with word-by-word captions](/blog-to-video-pipeline.png)

Search "blog to video" and you get the same twenty products. Vidup, Revid, Fliki, Pictory, HeyGen, Descript, GhostShorts. They all promise the same thing: paste a URL, get a short. They are also all subscriptions that want you to hand your content to somebody else's server.

That is a fine trade for a marketer. It is a bad trade if you write a technical blog, because the thing that makes your posts worth reading is the thing those tools cannot render: **code**. Stock footage with an AI voiceover does not explain a `docker run` flag.

So I built the self-hosted version instead. My articles already live as Markdown in a git repo, which means a video can be *derived* from them the same way the HTML is. This post is the full pipeline, start to finish, with the numbers and the failures included, because the failures are the part nobody writes down. If you are new to running an app on your own server, start with our [self-hosting guide for a first web app](/blog/self-hosting-your-first-web-app-no/).

> **Updated October 14, 2026.** Version 2 of the pipeline: scenes are now paced to reading speed instead of a fixed 4 seconds, reels reuse the article's own screenshots, and older reels are refreshed automatically, two a day. The new parts are [Step 2](/blog/blog-to-video-self-hosted-pipeline/#step-2---turn-an-article-into-props), [Step 6](/blog/blog-to-video-self-hosted-pipeline/#step-6---automate-it-on-publish) and three more entries in [what actually broke](/blog/blog-to-video-self-hosted-pipeline/#the-eight-things-that-actually-broke).

## What you end up with

One MP4 per article, 1080x1920, rendered automatically when you publish:

```text
src/content/blog/<slug>.md
        |
        |  1. article -> props        (Node, under a second)
        |     - parse frontmatter, ## sections, fenced code, images
        |     - copy the post's screenshots into reels/public/
        |     - plan scenes, sized to reading speed
        |     - syntax-highlight the code
        |     - synthesise a word-level caption track
        v
src/generated/<slug>.json            (fully-baked props)
        |
        |  2. props -> MP4            (Remotion, ~1.5 min on GitHub)
        v
article-reels/<slug>.mp4             (1080x1920, h264, 30fps)
```

The stack is smaller than it sounds:

| Piece | Job |
| --- | --- |
| [Remotion](https://www.remotion.dev/) | Turns React components into frames, and frames into an MP4 |
| [Code Hike](https://codehike.org/) | Syntax highlighting with animated token transitions |
| `@remotion/captions` | Groups a word-level transcript into TikTok-style pages |
| [sharp](https://sharp.pixelplumbing.com/) | Resizes and trims the article's screenshots for the reel |
| GitHub Actions | Runs the render on publish, and refreshes old reels daily |

There is no SaaS, no queue service and no database: it is self-hosted end to end. The only moving parts are a Node script and a headless Chromium, and the expensive one - rendering - costs about a minute and a half per reel on a free GitHub runner.

## Prerequisites

- **Node 22+** (the CLI wrapper uses `fs.statfsSync`, which landed in Node 18.15)
- **A repo with Markdown posts.** Frontmatter is nice but optional, first `# H1` becomes the title if you skip it.
- **GitHub**, for the automation half.

The first `npm install` pulls Remotion, which on first render downloads Chrome Headless Shell (~100 MB). Everything after that is offline.

## Step 1 - Scaffold the Remotion project

Keep it in a subfolder so it does not fight your site's build:

```bash
npx create-video@latest --blank reels
cd reels
npm install codehike @code-hike/lighter @remotion/captions @remotion/google-fonts @remotion/layout-utils @remotion/animation-utils
```

Two templates are worth stealing from rather than writing from scratch, and I merged both:

```bash
npx create-video@latest --code-hike   # animated code snippets
npx create-video@latest --tiktok      # word-by-word captions
```

Then register one composition. Everything interesting happens in its props, not in its config:

```tsx
// src/Root.tsx
<Composition
  id="Reel"
  component={Reel}
  fps={30}
  width={1080}
  height={1920}
  defaultProps={defaultProps}
  schema={reelPropsSchema}
  calculateMetadata={calculateReelMetadata}
/>
```

`1080x1920` at `30fps` is the whole reason this is a "reel" and not a video. Portrait, vertical, and short enough to hold attention.

One warning before you go further: **`calculateMetadata` is not where you should put your data loading.** A lot of Remotion examples do the heavy lifting there, and it works, but it runs in a browser context on every render. I put all of it in a Node script instead and passed the result in as props. The composition then renders the same video from the same JSON, every time, with no filesystem or network access of its own.

## Step 2 - Turn an article into props

This is the part with the actual intellectual work in it. A blog post is prose; a reel is a sequence of short beats. Something has to decide what survives, and how long each beat stays on screen.

Define the contract first. Every scene carries its own duration so the total is just a sum, which keeps the composition dumb and the renderer deterministic:

```js
// four scene types, that is the whole vocabulary
{ type: "title", kicker, title, subtitle, image?, durationInFrames }
{ type: "point", kicker, heading, body,  image?, durationInFrames }
{ type: "code",  kicker, heading, steps, stepDurations, durationInFrames }
{ type: "outro", heading, body, url,             durationInFrames }

// image = { src, width, height } - a screenshot copied from the article
```

Then parse the Markdown into `##` sections, remembering which fenced code blocks belong to which heading. Headings that *have* code become code scenes; headings with only prose become point scenes:

```js
for (const section of sections) {
  if (section.code.length) {
    scenes.push({ type: "code", heading: section.heading, steps: section.code, duration });
  } else {
    scenes.push({ type: "point", heading: section.heading, body: firstSentence(section.prose) });
  }
}
```

Three rules that took a few iterations to get right:

**Cap the reel, not the article.** Nine sections and 90 seconds maximum. A reel that tries to cover a 3,000 word post is just a fast slideshow nobody finishes.

**Trim the code.** A snippet of 40 lines is unreadable at phone size. Nine lines per step, two steps per section, and most posts end up with four or five code beats.

**Cut prose to one sentence.** Headings plus a single sentence read fine at reel speed. Paragraphs do not.

### Pace scenes by reading speed, not by the clock

Version 1 gave every text scene exactly 4 seconds and every code step about 3. That looked tidy in the code and was too fast to read. A 25-word sentence in 4 seconds is more than 6 words per second, so the captions flashed past before you could finish them, and nine lines of code disappeared in 3 seconds.

Now every scene is as long as its text takes to read:

```js
const PACE = {
  WORDS_PER_SECOND: 2.6, // ~155 words per minute
  LEAD_IN: 0.5,          // wait for the entrance animation
  HOLD: 0.9,             // a beat after the last word, before the cut
  IMAGE_BONUS: 1.2,      // extra time to look at a screenshot
  point: { min: 4.5, max: 11 },
  codeStep: { base: 2, perLine: 0.45, min: 4.5, max: 8 },
};

const seconds = LEAD_IN + words / WORDS_PER_SECOND + HOLD + (image ? IMAGE_BONUS : 0);
```

Code is paced per line instead of per word, because nobody reads code at prose speed. The caption track follows the same numbers: words start after the lead-in, and the last word stays up through the hold, so the screen never goes blank mid-scene.

The result is longer reels: most now run 60 to 90 seconds, up from 13 to 36. That sounds like the wrong direction for a short, but a reel people can actually read beats a short reel people scroll past. `WORDS_PER_SECOND` is the one dial to turn if you want it faster.

### Use the article's own screenshots

A technical post usually already has the best visuals it will ever get: the screenshots that show each step. Version 1 threw them away (the parser skipped every line starting with `![`). Now the builder collects the cover image plus the first image in each `##` section, and the point scene shows it in a window-style card under the heading:

```js
// one screenshot per section, plus the heroImage for the title scene
const markdown = /!\[([^\]]*)\]\(\s*(<[^>]+>|[^)\s]+)/g;  // also <img src="...">

const staged = await sharp(file)
  .trim({ threshold: 12 })            // drop flat margins (screenshots only)
  .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
  .webp({ quality: 88 })
  .toFile(`reels/public/post-media/${slug}/${name}.webp`);
```

![Before and after: the same reel scene with text only, and with the article's screenshot](/article-media/reel-before-after-screenshots.webp)

A few rules keep this from going wrong:

- **Copy, do not reference.** Remotion only serves local files from its own `public/` folder, so images are copied there at build time, resized, and given safe file names (spaces in `Screenshot 2026-09-29.png` are no fun in a URL).
- **Never crop a screenshot to fill a box.** The card takes the image's real size from the props and fits around it. A screenshot with its edges cut off is useless.
- **Scroll tall images.** A file tree or a full-page capture shrunk to fit is an unreadable sliver, so anything much taller than wide is shown wider and glides top to bottom during the scene.
- **Trim screenshots, not covers.** `trim()` removes the empty borders around a screenshot. On designed cover art it cut a 1600x900 image down to 1600x524, so covers are left alone.
- **A missing image is a warning, not a failure.** Posts without images still get the text-only reel.

Sections with code still show the code. The animated code is the one thing this pipeline does better than any screenshot.

### Highlight once, in Node

The composition should not be doing syntax highlighting at render time. Do it in the props builder, so the props file contains finished `HighlightedCode` objects:

```js
import { highlight } from "codehike/code";
import { getThemeColors } from "@code-hike/lighter";

const highlighted = await highlight({ lang, meta, value: code }, theme);
const themeColors = await getThemeColors(theme);
```

Both of those work in plain Node, which was the assumption that made the whole architecture viable. Highlighting in Node also means a failed highlight fails the build loudly, instead of producing a half-rendered video twenty minutes later.

### The caption track

I did not record a voiceover, so there is no audio to transcribe. Instead the builder synthesises a **word-level** caption track: for each scene, the on-screen text is split into words, and each word gets a slice of that scene's reading time, weighted by word length.

```js
const weights = words.map((w) => w.length + 3);
const totalWeight = weights.reduce((a, b) => a + b, 0);
// each word gets (weight / totalWeight) * readingTimeMs, starting after LEAD_IN
```

That is fake, of course. Nothing is being spoken. But it produces a caption track with real timing that the TikTok-style grouping can consume, and it means the reel works with zero audio infrastructure. Swapping in a real transcript later is a one-file change.

## Step 3 - Build the vertical composition

The composition is a `<Series>` of scenes, with three things painted on top for the whole duration: a brand bar, the caption overlay, and a segmented progress bar.

```tsx
<Series>
  {scenes.map((scene, i) => (
    <Series.Sequence key={i} durationInFrames={scene.durationInFrames}>
      <SceneRenderer scene={scene} />
    </Series.Sequence>
  ))}
</Series>
```

### Animated code, not a screenshot of code

Code Hike's trick is that it computes a per-token diff between two snippets and exposes it as keyframes, so identifiers physically move as one snippet becomes the next. You wire it up once:

```tsx
const transitions = calculateTransitions(ref.current!, oldSnapshot);
transitions.forEach(({ element, keyframes, options }) => {
  const progress = interpolate(frame, [delay, delay + duration], [0, 1], { easing });
  applyStyle({ element, keyframes, progress, linearProgress });
});
```

Pass `oldCode={null}` for the first snippet in a scene and the code fades in from nothing. That single detail is what makes the code scenes feel like motion instead of a slide.

### Captions that highlight the word being read

`createTikTokStyleCaptions` groups the word track into pages, and each page renders its tokens with the currently-active one in a different colour:

```tsx
const startRelativeToPage = token.fromMs - page.startMs;
const active = startRelativeToPage <= timeInMs && token.toMs > timeInMs;
<span style={{ color: active ? BRAND.lime : BRAND.white }}>{token.text}</span>
```

A text stroke behind the fill (`paintOrder: "stroke"`) keeps it legible over any frame. That, plus uppercase and a 900 font weight, is the entire "TikTok caption" aesthetic.

## Step 4 - Render it

Three commands cover everything, and you should use all three in that order:

```bash
npm run dev                       # Remotion Studio: live preview, hot reload
npx remotion render Reel out/reel.mp4 --props=src/generated/my-post.json
npx remotion still  Reel out/poster.png --props=... --frame=210
```

Studio is the single most valuable thing in this whole stack. You get a real timeline, a real video element and instant feedback on animation curves, and it would have taken me five times as long to build any of this without it.

`still` matters more than it looks. Rendering one frame takes a few seconds, while a full 90-second reel takes minutes, so it is the right way to check a layout tweak.

### Shell out to the CLI, do not use the SSR APIs

Remotion also exposes `@remotion/bundler` and `@remotion/renderer` for Node, which is the "proper" programmatic path. I deliberately did **not** use it, and the docs say why:

> If you have a webpack override in `remotion.config.ts`, pass it here as well.

The Code Hike setup needs exactly such an override (an alias to `@code-hike/lighter`'s ESM build). The CLI reads `remotion.config.ts` automatically; the Node API does not, so you have to keep the two in sync by hand. Shelling out to `remotion render` inherits the CLI's config, its browser management *and* its retry behaviour for free. If your build config is non-trivial, the CLI is the more robust API.

## Step 5 - One command per article

Wrap the two halves into a script so you never think about props files again:

```bash
node scripts/render-reel.mjs --slug my-post           # props + render
node scripts/render-reel.mjs --latest                 # newest by pubDate
node scripts/render-reel.mjs --all                    # every article
node scripts/render-reel.mjs --latest --duration 8     # an 8s teaser
node scripts/render-reel.mjs --latest --max-seconds 20 # cap the reel length
```

It rebuilds props from Markdown first, so a single command always renders the current state of the article. `--max-seconds` is what turns "a video" into "a short": the scene planner stops adding sections once the budget is spent.

### Make it idempotent

Before wiring up automation, add a way to ask *what still needs doing*:

```js
// scripts/list-missing-reels.mjs
for (const slug of await listArticles()) {
  if (!fs.existsSync(reelPath(slug))) entries.push(slug);   // no reel yet
}
entries.sort((a, b) => b.published - a.published);          // newest first
```

This one small script is what makes the CI job safe. Rendering is the slow, expensive, failure-prone part, and "which posts don't have a reel" is a question that is always answerable from the filesystem. A commit diff is not: it breaks on re-runs, on rebases, and on failed renders. Sorting newest-first means a fresh post always wins the next available slot.

## Step 6 - Automate it on publish

Here is the trap that cost me the most time, and it is specific to how a lot of blogs publish.

I already [automate LinkedIn cross-posting](/blog/automate-linkedin-posts-github-actions/) from this same repo, which is how I recognised the shape of the problem immediately - and I still lost an hour to it anyway.

Many repos publish scheduled posts from a GitHub Action, which means the publish commit is pushed with the automatic `GITHUB_TOKEN`. **`GITHUB_TOKEN` pushes do not trigger other workflows.** This is documented by GitHub and it is deliberate, to stop recursive workflow loops. The consequence is that a reel workflow triggered by `push` would take one look at your daily scheduled publish and do absolutely nothing, forever, silently.

So the workflow needs two automatic triggers, not one:

```yaml
on:
  push:
    branches: [main]
    paths: ['src/content/blog/**']
  workflow_run:
    workflows: ["Schedule post publishing"]   # <- the one that actually fires
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      slug: { required: false }
      max:  { required: false, default: "5" }
      force: { required: false, type: boolean, default: false }
      refresh: { required: false, default: "0" }  # outdated reels to redo
  schedule:
    - cron: "30 10 * * *"   # daily refresh of older reels, see below
```

The `push` trigger catches normal commits. The `workflow_run` trigger catches everything the scheduler publishes, because "that workflow finished" is an event the `GITHUB_TOKEN` restriction does not apply to. Both paths then run the *same* job, which asks *list-missing-reels* what to do. One code path, three ways in.

```yaml
- name: Work out which articles need a reel
  run: node scripts/list-missing-reels.mjs --limit "${MAX_REELS:-3}" > "$RUNNER_TEMP/slugs.txt"

- name: Render reels
  run: |
    while IFS= read -r slug; do
      node scripts/render-reel.mjs --slug "$slug" \
        --out "$GITHUB_WORKSPACE/article-reels/$slug.mp4" || failed=$((failed + 1))
    done < "$RUNNER_TEMP/slugs.txt"
```

A few details that matter in practice:

- **Cap automatic runs** (3 reels). Without a cap, the first run tries to backfill every post you have ever written and burns an hour of runner time. Manual runs pass a bigger `max`.
- **Do not `set -e` the render loop.** One article with a pathological code block should not abandon the other two.
- **Cache the browser.** The Chrome Headless Shell download is ~100 MB; `actions/cache` on `node_modules/.remotion` makes the second run minutes faster.
- **Upload artifacts as well as committing.** Artifacts survive a rejected push, a protected branch, or a race with another workflow.
- **Do not commit with `set -e` semantics you do not want.** The bot's commit is skipped cleanly when nothing changed, using `git diff --cached --quiet`.
- **Rebase before pushing.** A render takes minutes, and a scheduled post can land on `main` in the meantime. `git pull --rebase` before `git push` stops the reel commit from being rejected.

### Refresh old reels when the design changes

Changing the pacing and adding screenshots raised a new problem: 30 reels already existed, and *list-missing-reels* only renders posts that have no reel at all. Re-rendering all 30 in one run is about 45 minutes of runner time and one giant commit.

So each reel now records which version of the pipeline made it, in `article-reels/.reel-versions.json`:

```json
{
  "blog-to-video-self-hosted-pipeline": 2,
  "how-to-add-onedrive-to-windows-file-explorer": 2
}
```

The builder exports a `REEL_VERSION` constant (now `2`). Any reel with a lower number, or not in the file at all, counts as outdated. The same planning script returns missing reels first, then a few outdated ones:

```bash
node scripts/list-missing-reels.mjs --limit 3 --refresh 2   # what to render
node scripts/list-missing-reels.mjs --mark "$slug"          # after a good render
node scripts/list-missing-reels.mjs --status
# reel version 2: 0 missing, 28 outdated
```

A daily `schedule` trigger runs the workflow with `--refresh 2`, so the old reels catch up two a day, newest posts first, without ever delaying a new post's reel. When every reel is current, the daily run renders nothing. The next time I change the design, I bump `REEL_VERSION` to `3` and the same schedule does the rest.

## Step 7 - Optional: a paste-a-Markdown GUI

Once `buildReelPropsFromMarkdown({ markdown })` exists as a function, a web UI is about eighty lines of Express. The only part worth calling out is that the GUI should shell out to the same render script rather than reimplementing anything, so the button and the CLI can never disagree:

```js
await spawnRemotion({
  cliArgs: ["render", "Reel", output, `--props=${propsFile}`, "--log=info"],
  onLine: (line) => progress.parse(line),
});
```

Parse Remotion's own stdout for `Rendered 388/520` and you get a real progress bar for free. Queue the jobs and run them one at a time; two Chromes on one small machine is how you find out what an OOM kill looks like.

## The eight things that actually broke

This is the section I wish every "here's my pipeline" post had. All eight of these produced *silent* or *misleading* failures. The last three turned up in version 2.

### 1. One arrow character crashed the browser

**Symptom:** the renderer died on frames 604-607. Every time. `Protocol error (Runtime.callFunctionOn): Target closed.` Other frames rendered fine.

**What was happening:** the outro scene drew a `→` (U+2192). The UI font is loaded as the **latin subset** only, which does not contain the arrow, so Chromium fell back to a system font for that one glyph. In a container with no system fonts installed, that fallback path kills the renderer process outright.

**How I found it:** by bisecting. Replacing the arrow with the words "Read more" made those frames render; putting the arrow back re-broke them, reproducibly.

**Fix:** draw symbols as inline SVG instead of text, and audit for risky glyphs at build time. The props builder now scans every string it is about to render and replaces anything outside the font subset with a space, reporting what it replaced:

```text
! my-post: replaced non-Latin glyphs: "→" (U+2192) x2
```

If you take one thing from this article: **an emoji in a headline is a landmine** in a fontless CI container.

### 2. A 64 MB `/dev/shm` killed Chrome mid-render

**Symptom:** `Target closed` at random frames, worse with more parallelism.

**What was happening:** Remotion keeps roughly **8 MB of shared memory per concurrent render tab**. My container mounted a 64 MB `/dev/shm`, so eight tabs was the entire budget, and Remotion happily opens one per core (60, here).

**Fix:** tell Remotion to use file-backed pools instead of POSIX shared memory:

```bash
export REMOTION_SHARED_MEMORY_BACKEND=file
```

The render script now checks the size of `/dev/shm` and sets that automatically when it is under 512 MB. The alternative, lowering `--concurrency`, also works, just slower.

### 3. Syntax-highlighted code rendered black on dark

**Symptom:** code was technically there, and nearly invisible.

**What was happening:** Code Hike's `<Pre>` component renders a plain `<pre>` and does **not** apply the `code.style` that the highlighter hands it. Theme colours are the caller's job. With no explicit colour, the text inherited the document default.

**Fix:** pass the colour explicitly from the theme:

```tsx
style={{ color: themeColors.editor.foreground, background: "transparent" }}
```

### 4. Every download 404'd, and the logs said nothing

**Symptom:** the GUI rendered videos correctly, then refused to serve them. `NotFoundError: Not Found` from `res.sendFile`.

**What was happening:** Express's underlying `send` refuses paths containing a dot-directory. My scratch space was `server/.work/<id>/`, so a valid, existing, correctly-permissioned file was unservable purely because a parent folder started with a dot.

**Fix:** rename it (`server/work/`), and pass `{ dotfiles: "allow" }` as a belt-and-braces guard.

### 5. One caption page ate the entire video

**Symptom:** instead of 3-4 words at a time, the caption bar showed a 20-second wall of text.

**What was happening:** `createTikTokStyleCaptions` only starts a new page when an incoming token's text **begins with a space** - the convention Whisper output follows. My generated words had no leading spaces, so the grouping logic never saw a boundary.

**Fix:** prefix every word with a space, and mark the last word of each scene with `pageBreakAfter: true` so a page can never bleed across a scene boundary.

### 6. Two caption lines drawn on top of each other

**Symptom:** once the pacing changed, a test frame showed two caption pages stacked over each other, each with its own highlighted word.

**What was happening:** each caption page was placed with `Math.floor` for its start frame and `Math.round` for its length. Those two roundings could disagree by one frame, so a page sometimes ended one frame after the next one started. At 4-second scenes that frame was easy to miss; this bug had been in every version 1 reel.

**Fix:** end every page at the next page's start frame at the latest:

```tsx
const next = pages[index + 1];
if (next) endFrame = Math.min(endFrame, Math.floor((next.startMs / 1000) * fps));
```

The same check turned up a second problem. `combineTokensWithinMilliseconds` was set to 1100 ms. At reading speed, four words take about 1.5 seconds, so the timer split every 4-word page and left single words flashing up for a fifth of a second. The builder already forces a page break every four words, so the timer is now just a safety net at 2200 ms.

### 7. An invisible character hid a post's title

**Symptom:** one post came out of the builder with its file name as the title, the generic "Tech" category and no cover image, even though its frontmatter was correct.

**What was happening:** that Markdown file started with a UTF-8 byte-order mark, an invisible character some Windows editors add. My frontmatter regex expects the file to start with `---`, so it found no frontmatter at all and fell back to the defaults.

**Fix:** one line, before parsing:

```js
const source = rawSource.replace(/^\uFEFF/, "");
```

### 8. A trailing comma meant a post never got a reel

**Symptom:** one post simply had no reel. The workflow logged a `ZodError` and moved on to the next post, exactly as designed, so nothing looked broken.

**What was happening:** the post had `tags: [ "Web Apps", "Deployment", ]`. That trailing comma is valid YAML, so Astro built the page fine, but my small frontmatter parser used `JSON.parse`, which rejects it. The tags became one long string, and the props schema refused it.

**Fix:** treat flow lists as YAML, not JSON: drop a trailing comma, and fall back to splitting on commas. The lesson is the same as the arrow in #1: a blog post that the site accepts can still break a stricter tool down the line, so test the renderer against every post you have, not just the newest one.

## What it costs and what it produces

Version 2 reels, rendered at 1080x1920 H.264 on a standard GitHub-hosted runner:

| Article | Scenes | Screenshots | Reel | Frames | Output | Render |
| --- | --- | --- | --- | --- | --- | --- |
| Add OneDrive to File Explorer | 9 | 5 | 88.1s | 2,643 | 12 MB | ~1m 50s |
| Google OAuth for Blogger | 10 | 1 | 89.2s | 2,676 | 7 MB | ~1m 35s |
| This article | 11 | 1 | 67.8s | 2,035 | 4.7 MB | ~1m 15s |

For comparison, version 1 reels were 13 to 36 seconds long and 1 to 3.5 MB each. Building props for all 31 posts, image staging included, still takes well under a minute; the render is the real cost.

Reels are now 5 to 12 MB, and screenshot-heavy posts are at the top of that range because real images compress worse than flat colour. That is still fine in a repo for a long time; if you would rather not, skip the commit step and keep the artifacts.

## FAQ

**Why not just pay for a blog-to-video tool?**

Honestly, if your posts are listicles with no code in them, you probably should. Those tools are faster, need no
maintenance, and will source stock imagery you do not have. Self-hosting wins in three narrower cases: your posts
contain code, your brand is defined in code, or you object to uploading drafts to a third party. Those are also
exactly the cases where a generic tool falls over.

**Do I need a voiceover?** No. The captions are synthesised from the on-screen script, which is why the pipeline works with no audio at all. If you *do* want narration, transcribe it with Whisper, feed the word-level result in as the caption track, and add an `<Audio>` tag.

**Does it work for non-technical posts?** Yes, and better than you would expect, because point scenes and captions do not care what the subject is. Step-by-step guides with screenshots work especially well now, because every step's screenshot becomes its own scene. You just lose the code scenes, which is the one thing this approach does better than a generic tool.

**Can I make the reels shorter?** Yes. Pass `--max-seconds 30` for a shorter cut, or raise `WORDS_PER_SECOND` if you would rather keep every section and read faster.

**Can I avoid committing the MP4s?** Yes. Drop the commit step and keep only `actions/upload-artifact`. You lose the convenience of `article-reels/<slug>.mp4` living in the repo, and you keep the repo small.

**Is Remotion free?** Remotion is free for individuals and companies of up to three people. Beyond that it needs a Company License, and cloud rendering has its own terms. If you are deploying this at work, read that page first. It is a real constraint, not a footnote.

**Do I have to run it in CI?** No. `--latest` on a cron or a git hook does the same job. CI is attractive because the runner already has a clean Linux box with fonts and libraries, which - as the section above shows - is not a given in a container.

## Should you self-host your own blog-to-video pipeline?

A generic blog-to-video tool will produce something passable in a minute. This pipeline produces something *better* for a technical post, because it can show your actual code and your actual screenshots, in your actual brand colours, with captions you can read at a normal pace. It also costs nothing per video and never sees a rate limit.

The trade is honest though: it is a weekend of work, and you own the failures. When a render dies at frame 604, nobody is going to fix it for you.

Start smaller than I did. Clone the Code Hike and TikTok templates, get one article rendering locally with `npm run dev`, and only then add the automation. The GitHub Actions half is thirty lines, but it is thirty lines that will happily do nothing at all if you get the trigger wrong.
