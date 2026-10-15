import React from "react";
import {
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../brand";
import { ReelImage } from "../schema";

/**
 * A screenshot / article image in a rounded "window" card.
 *
 * The image is always shown whole (contain, never cropped - screenshots are
 * useless with their edges cut off) and fitted into `maxWidth` x `maxHeight`
 * using the real dimensions baked into the props, so the card hugs the image.
 * A very slow push-in keeps a still frame from feeling frozen.
 */
export const ScreenshotCard: React.FC<{
  readonly image: ReelImage;
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly delay?: number;
  readonly chrome?: boolean;
}> = ({ image, maxWidth, maxHeight, delay = 0, chrome = true }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const barHeight = chrome ? 46 : 0;
  const ratio = image.width / image.height;
  const viewport = maxHeight - barHeight;

  // Fit the whole image into the card...
  let width = maxWidth;
  let height = width / ratio;
  if (height > viewport) {
    height = viewport;
    width = height * ratio;
  }

  // ...unless it is a tall screenshot (file trees, long pages, phone shots)
  // that would shrink to an unreadable sliver. Those are shown wider and
  // scrolled top-to-bottom through the card over the scene instead.
  let imageHeight = height;
  let scroll = 0;
  if (ratio < 0.75) {
    const scrollWidth = Math.min(maxWidth, viewport * ratio * 2.2);
    if (scrollWidth > width * 1.15) {
      width = scrollWidth;
      height = viewport;
      imageHeight = width / ratio;
      scroll = imageHeight - viewport;
    }
  }

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, mass: 0.7 },
    durationInFrames: 26,
  });

  const zoom = scroll
    ? 1
    : interpolate(
        frame,
        [delay, Math.max(delay + 1, durationInFrames)],
        [1, 1.045],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );

  // Hold the top for a moment, glide down, and hold the bottom before the cut.
  const scrollStart = delay + Math.round(fps * 1.2);
  const scrollEnd = Math.max(scrollStart + 1, durationInFrames - Math.round(fps * 1));
  const offset = scroll
    ? interpolate(frame, [scrollStart, scrollEnd], [0, scroll], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      })
    : 0;

  return (
    <div
      style={{
        width,
        borderRadius: 26,
        overflow: "hidden",
        border: `2px solid ${BRAND.grid}`,
        backgroundColor: BRAND.surface,
        boxShadow:
          "0 40px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(182,255,43,0.08), 0 0 60px rgba(182,255,43,0.08)",
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [60, 0])}px) scale(${interpolate(enter, [0, 1], [0.94, 1])})`,
      }}
    >
      {chrome ? (
        <div
          style={{
            height: barHeight,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 22px",
            borderBottom: `2px solid ${BRAND.grid}`,
          }}
        >
          {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
            <span
              key={color}
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                backgroundColor: color,
              }}
            />
          ))}
        </div>
      ) : null}
      <div style={{ width, height, overflow: "hidden" }}>
        <Img
          src={staticFile(image.src)}
          style={{
            width: "100%",
            height: imageHeight,
            objectFit: "contain",
            transform: `translateY(${-offset}px) scale(${zoom})`,
            transformOrigin: "50% 40%",
          }}
        />
      </div>
    </div>
  );
};
