/**
 * Brand tokens for TechTips.fun.
 * Mirrors the palette used by `scripts/generate-social-assets.mjs` so reels and
 * OG cards stay visually consistent.
 */
export const BRAND = {
  background: "#101214",
  surface: "#171b1c",
  grid: "#262a2b",
  white: "#f7f8f6",
  muted: "#919594",
  lime: "#b6ff2b",
  limeInk: "#0a0c0c",
  accentDim: "#486144",
  site: "techtips.fun",
  author: "SaonBD",
  tagline: "SEO · AI · Open source · Web3",
} as const;

export const REEL = {
  width: 1080,
  height: 1920,
  fps: 30,
} as const;

/** Where the on-screen content sits (leaves room for captions in the lower third). */
export const SAFE_AREA = {
  paddingX: 72,
  paddingTop: 210,
  paddingBottom: 760,
  // Scenes that show a screenshot use more of the frame; this still stops
  // well above the caption band (captions sit ~300px from the bottom).
  paddingBottomWithImage: 600,
} as const;
