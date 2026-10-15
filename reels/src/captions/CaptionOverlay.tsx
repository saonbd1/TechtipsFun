import {
  Caption,
  createTikTokStyleCaptions,
  TikTokPage,
} from "@remotion/captions";
import { makeTransform, scale, translateY } from "@remotion/animation-utils";
import { fitText } from "@remotion/layout-utils";
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../brand";
import { uiFontFamily } from "../fonts";
import { ReelCaption } from "../schema";

// A caption page is flushed once it has been on screen this long. The props
// builder already forces a page break every 4 words (pageBreakAfter), so this
// is only a safety net: at reading speed 4 words take ~1.5s, and a lower value
// would split them and flash a lone leftover word.
const COMBINE_TOKENS_WITHIN_MS = 2200;

const DESIRED_FONT_SIZE = 96;
const CAPTION_BOTTOM_PADDING = 300;

/**
 * One caption "page": a group of words where the word being "spoken" right now
 * is highlighted in brand lime.
 */
export const CaptionPage: React.FC<{ readonly page: TikTokPage }> = ({
  page,
}) => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();
  const timeInMs = (frame / fps) * 1000;

  const enter = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 5,
  });

  const fittedText = fitText({
    fontFamily: uiFontFamily,
    text: page.text,
    withinWidth: width * 0.86,
    textTransform: "uppercase",
  });

  const fontSize = Math.min(DESIRED_FONT_SIZE, fittedText.fontSize);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: CAPTION_BOTTOM_PADDING,
        paddingLeft: width * 0.06,
        paddingRight: width * 0.06,
      }}
    >
      <div
        style={{
          textAlign: "center",
          fontSize,
          fontFamily: uiFontFamily,
          fontWeight: 900,
          textTransform: "uppercase",
          lineHeight: 1.12,
          color: BRAND.white,
          WebkitTextStroke: "16px rgba(0,0,0,0.88)",
          paintOrder: "stroke",
          transform: makeTransform([
            scale(interpolate(enter, [0, 1], [0.86, 1])),
            translateY(interpolate(enter, [0, 1], [40, 0])),
          ]),
        }}
      >
        {page.tokens.map((token, index) => {
          const startRelativeToPage = token.fromMs - page.startMs;
          const endRelativeToPage = token.toMs - page.startMs;
          const active =
            startRelativeToPage <= timeInMs && endRelativeToPage > timeInMs;

          return (
            <span
              key={`${token.fromMs}-${index}`}
              style={{
                display: "inline",
                whiteSpace: "pre",
                color: active ? BRAND.lime : BRAND.white,
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Turns the reel's word-level caption track into TikTok-style pages and renders
 * them across the whole timeline.
 */
export const CaptionOverlay: React.FC<{
  readonly captions: ReelCaption[];
}> = ({ captions }) => {
  const { fps } = useVideoConfig();

  const { pages } = useMemo(() => {
    const normalized: Caption[] = captions.map((caption) => ({
      text: caption.text,
      startMs: caption.startMs,
      endMs: caption.endMs,
      timestampMs: null,
      confidence: null,
      ...(caption.pageBreakAfter ? { pageBreakAfter: true } : {}),
    }));

    return createTikTokStyleCaptions({
      combineTokensWithinMilliseconds: COMBINE_TOKENS_WITHIN_MS,
      captions: normalized,
    });
  }, [captions]);

  return (
    <>
      {pages.map((page, index) => {
        const startFrame = Math.floor((page.startMs / 1000) * fps);
        let endFrame = Math.round(((page.startMs + page.durationMs) / 1000) * fps);
        // Never overlap the next page (rounding used to leave a 1-frame overlap
        // where two caption lines were drawn on top of each other).
        const next = pages[index + 1];
        if (next) {
          endFrame = Math.min(endFrame, Math.floor((next.startMs / 1000) * fps));
        }
        const durationInFrames = Math.max(1, endFrame - startFrame);

        return (
          <Sequence
            key={index}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <CaptionPage page={page} />
          </Sequence>
        );
      })}
    </>
  );
};
