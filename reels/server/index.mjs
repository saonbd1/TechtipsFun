#!/usr/bin/env node
/**
 * Reel Studio - a small GUI on top of the article -> reel pipeline.
 *
 *   npm run gui        (then open http://localhost:4317)
 *
 * Paste Markdown, hit Generate, get an MP4. Rendering shells out to the
 * Remotion CLI, so the GUI shares exactly the same code path as
 * `npm run reel` (including the remotion.config.ts alias and the /dev/shm
 * fallback).
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  buildReelPropsFromMarkdown,
  listArticles,
  readArticle,
} from "../scripts/build-reel-props.mjs";
import {
  COMPOSITION_ID,
  FPS,
  createProgressParser,
  spawnRemotion,
} from "../scripts/lib/remotion-cli.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORK_DIR = path.join(HERE, "work");
const PORT = Number(process.env.PORT ?? 4317);

const THEMES = [
  "github-dark",
  "github-dark-dimmed",
  "one-dark-pro",
  "dracula",
  "nord",
  "monokai",
  "poimandres",
  "material-ocean",
  "github-light",
  "min-light",
  "solarized-light",
];

const DEFAULT_THEME = "github-dark";
const DEFAULT_MAX_SECONDS = 90;

/* ------------------------------------------------------------------- jobs */

const jobs = new Map();
let queueTail = Promise.resolve();

const createJob = (kind) => {
  const id = crypto.randomBytes(8).toString("hex");
  const job = {
    id,
    kind,
    status: "queued",
    percent: 0,
    label: "Queued",
    logs: [],
    outputPath: null,
    fileName: null,
    error: null,
    meta: null,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
};

/** Renders are serialised: one Chrome at a time keeps small hosts happy. */
const enqueue = (job, work) => {
  queueTail = queueTail.then(async () => {
    job.status = "running";
    try {
      job.meta = await work(job);
      job.status = "done";
      job.percent = 100;
      job.label = "Done";
    } catch (error) {
      job.status = "failed";
      job.label = "Failed";
      job.error = error instanceof Error ? error.message : String(error);
    }
  });
  return job;
};

const trackProgress = (job) => {
  const parser = createProgressParser();
  return (line) => {
    const { percent, label } = parser.parse(line);
    job.percent = Math.max(job.percent, percent);
    job.label = label;
    job.logs.push(line);
    if (job.logs.length > 60) job.logs.shift();
  };
};

const publicJob = (job) => ({
  id: job.id,
  kind: job.kind,
  status: job.status,
  percent: job.percent,
  label: job.label,
  error: job.error,
  fileUrl: job.fileName ? `/api/files/${job.id}` : null,
  logs: job.logs.slice(-12),
  meta: job.meta,
});

/* ---------------------------------------------------------------- helpers */

const numberOr = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const summarize = (props, removedGlyphs) => ({
  slug: props.slug,
  title: props.title,
  category: props.category,
  description: props.description,
  durationInFrames: props.durationInFrames,
  durationSeconds: Number((props.durationInFrames / FPS).toFixed(1)),
  captionWords: props.captions.length,
  theme: props.theme,
  removedGlyphs,
  scenes: props.scenes.map((scene) => ({
    type: scene.type,
    label:
      scene.type === "title"
        ? scene.title
        : scene.type === "outro"
          ? scene.heading
          : (scene.heading ?? ""),
    seconds: Number((scene.durationInFrames / FPS).toFixed(1)),
    durationInFrames: scene.durationInFrames,
    codeSteps: scene.type === "code" ? scene.steps.length : undefined,
  })),
});

/** Snap to ~55% through the scene containing `fraction` of the timeline. */
const pickFrame = (props, fraction = 0.4) => {
  const target = Math.floor(props.durationInFrames * fraction);
  let cursor = 0;

  for (const scene of props.scenes) {
    const start = cursor;
    cursor += scene.durationInFrames;
    if (target < cursor) {
      return Math.min(
        props.durationInFrames - 1,
        Math.floor(start + scene.durationInFrames * 0.55),
      );
    }
  }

  return Math.max(0, props.durationInFrames - 1);
};

const writePropsFile = async (jobId, props) => {
  const dir = path.join(WORK_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "props.json");
  await fs.writeFile(file, JSON.stringify(props));
  return { dir, file };
};

/* ------------------------------------------------------------------- app */

const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(HERE, "public")));

app.get("/api/meta", (_req, res) => {
  res.json({
    themes: THEMES,
    defaultTheme: DEFAULT_THEME,
    defaultMaxSeconds: DEFAULT_MAX_SECONDS,
    fps: FPS,
  });
});

app.get("/api/posts", async (_req, res, next) => {
  try {
    res.json({ posts: await listArticles() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/posts/:slug", async (req, res, next) => {
  try {
    const { source } = await readArticle(req.params.slug);
    res.json({ slug: req.params.slug, markdown: source });
  } catch (error) {
    next(error);
  }
});

app.post("/api/inspect", async (req, res, next) => {
  try {
    const { markdown, theme, maxSeconds } = req.body ?? {};
    if (!markdown || !markdown.trim()) {
      res.status(400).json({ error: "Paste some Markdown first." });
      return;
    }

    const { props, removedGlyphs } = await buildReelPropsFromMarkdown({
      markdown,
      theme: theme || DEFAULT_THEME,
      maxSeconds: numberOr(maxSeconds, DEFAULT_MAX_SECONDS),
    });

    res.json(summarize(props, removedGlyphs));
  } catch (error) {
    next(error);
  }
});

app.post("/api/still", (req, res, next) => {
  try {
    const { markdown, theme, maxSeconds, at } = req.body ?? {};
    const job = createJob("still");

    enqueue(job, async (current) => {
      const { props } = await buildReelPropsFromMarkdown({
        markdown,
        theme: theme || DEFAULT_THEME,
        maxSeconds: numberOr(maxSeconds, DEFAULT_MAX_SECONDS),
      });

      const { dir, file } = await writePropsFile(current.id, props);
      const frame = pickFrame(props, Number(at) || 0.4);
      const output = path.join(dir, "poster.png");

      await spawnRemotion({
        cliArgs: [
          "still",
          COMPOSITION_ID,
          output,
          `--props=${file}`,
          `--frame=${frame}`,
          "--log=error",
        ],
        onLine: trackProgress(current),
      });

      current.outputPath = output;
      current.fileName = "poster.png";
      return { frame, seconds: Number((frame / FPS).toFixed(1)) };
    });

    res.json({ jobId: job.id });
  } catch (error) {
    next(error);
  }
});

app.post("/api/render", (req, res, next) => {
  try {
    const { markdown, theme, maxSeconds, clipSeconds } = req.body ?? {};
    if (!markdown || !markdown.trim()) {
      res.status(400).json({ error: "Paste some Markdown first." });
      return;
    }

    const job = createJob("video");

    enqueue(job, async (current) => {
      const { props } = await buildReelPropsFromMarkdown({
        markdown,
        theme: theme || DEFAULT_THEME,
        maxSeconds: numberOr(maxSeconds, DEFAULT_MAX_SECONDS),
      });

      const { dir, file } = await writePropsFile(current.id, props);
      const output = path.join(dir, `${props.slug}.mp4`);

      const cliArgs = [
        "render",
        COMPOSITION_ID,
        output,
        `--props=${file}`,
        "--log=info",
      ];

      if (clipSeconds) {
        const frames = Math.round(numberOr(clipSeconds, 0) * FPS);
        if (frames > 0) cliArgs.push(`--frames=0-${frames - 1}`);
      }

      await spawnRemotion({ cliArgs, onLine: trackProgress(current) });

      current.outputPath = output;
      current.fileName = `${props.slug}.mp4`;
      return { seconds: Number((props.durationInFrames / FPS).toFixed(1)) };
    });

    res.json({ jobId: job.id });
  } catch (error) {
    next(error);
  }
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Unknown job" });
    return;
  }
  res.json(publicJob(job));
});

app.get("/api/files/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job?.outputPath) {
    res.status(404).json({ error: "No output for that job" });
    return;
  }
  // dotfiles: "allow" keeps send() happy about dot-directories in the path.
  res.sendFile(job.outputPath, { dotfiles: "allow" });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message ?? "Unexpected error" });
});

await fs.mkdir(WORK_DIR, { recursive: true });
app.listen(PORT, () => {
  console.log(`Reel Studio running at http://localhost:${PORT}`);
  console.log("Paste an article, then hit Generate.");
});
