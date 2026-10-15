import { HighlightedCode } from "codehike/code";
import { z } from "zod";
import { ThemeColors, themeSchema } from "./theme";

export const captionSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  pageBreakAfter: z.boolean().optional(),
});

/**
 * Props are *fully baked* by `scripts/build-reel-props.mjs`: code steps are
 * already highlighted and the theme colours are already resolved, so the
 * composition stays a pure function of its props (no fs / network reads).
 *
 * `scenes` is intentionally loose here - Code Hike's `HighlightedCode` has a
 * deeply nested shape and zod would strip the fields we need to render. The
 * shape is enforced by the builder instead.
 */
export const reelPropsSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  url: z.string(),
  theme: themeSchema,
  durationInFrames: z.number().int().positive(),
  scenes: z.array(z.any()).min(1),
  captions: z.array(captionSchema),
  themeColors: z.any(),
});

export type ReelCaption = z.infer<typeof captionSchema>;
export type ReelTheme = z.infer<typeof themeSchema>;

/** An article image staged in reels/public by scripts/lib/post-media.mjs. */
export type ReelImage = {
  src: string;
  width: number;
  height: number;
};

export type TitleScene = {
  type: "title";
  kicker: string;
  title: string;
  subtitle: string;
  image?: ReelImage;
  durationInFrames: number;
};

export type PointScene = {
  type: "point";
  kicker: string;
  heading: string;
  body: string;
  image?: ReelImage;
  durationInFrames: number;
};

export type CodeSceneData = {
  type: "code";
  kicker: string;
  heading: string;
  steps: HighlightedCode[];
  /** Per-step frames (sums to durationInFrames); older props split evenly. */
  stepDurations?: number[];
  durationInFrames: number;
};

export type OutroScene = {
  type: "outro";
  heading: string;
  body: string;
  url: string;
  durationInFrames: number;
};

export type ReelScene = TitleScene | PointScene | CodeSceneData | OutroScene;

export type ReelProps = {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  url: string;
  theme: ReelTheme;
  durationInFrames: number;
  scenes: ReelScene[];
  captions: ReelCaption[];
  themeColors: ThemeColors;
};
