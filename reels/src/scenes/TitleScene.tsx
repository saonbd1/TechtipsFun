import React from "react";
import { AbsoluteFill } from "remotion";
import { BRAND, REEL, SAFE_AREA } from "../brand";
import { ScreenshotCard } from "../components/ScreenshotCard";
import { uiFontFamily } from "../fonts";
import { TitleScene as TitleSceneData } from "../schema";
import { headlineFontSize, wrapText } from "../utils";
import { Enter } from "../components/Enter";

export const TitleScene: React.FC<{ readonly scene: TitleSceneData }> = ({
  scene,
}) => {
  const hasImage = Boolean(scene.image);
  const lines = wrapText(scene.title, hasImage ? 19 : 16);
  const fontSize = headlineFontSize(
    lines.length,
    hasImage ? { max: 88, min: 54 } : { max: 112, min: 64 },
  );
  const paddingBottom = hasImage
    ? SAFE_AREA.paddingBottomWithImage
    : SAFE_AREA.paddingBottom;
  // Leave the headline room; the cover never takes more than ~45% of the area.
  const contentHeight = REEL.height - SAFE_AREA.paddingTop - paddingBottom;
  const imageMaxHeight = Math.min(
    560,
    contentHeight - (30 + 30 + lines.length * fontSize * 1.05 + 46 + 50 + 48),
  );

  return (
    <AbsoluteFill
      style={{
        padding: `${SAFE_AREA.paddingTop}px ${SAFE_AREA.paddingX}px ${paddingBottom}px`,
        justifyContent: "center",
        fontFamily: uiFontFamily,
      }}
    >
      {scene.image ? (
        <div style={{ marginBottom: 48, display: "flex", justifyContent: "center" }}>
          <ScreenshotCard
            image={scene.image}
            maxWidth={REEL.width - SAFE_AREA.paddingX * 2}
            maxHeight={imageMaxHeight}
            chrome={false}
          />
        </div>
      ) : null}
      <Enter delay={hasImage ? 6 : 0}>
        <div
          style={{
            color: BRAND.lime,
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 30,
          }}
        >
          {scene.kicker}
        </div>

        <div
          style={{
            color: BRAND.white,
            fontSize,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -1.5,
          }}
        >
          {lines.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>

        <div
          style={{
            marginTop: 46,
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              width: 68,
              height: 5,
              borderRadius: 999,
              backgroundColor: BRAND.lime,
            }}
          />
          <div
            style={{ color: BRAND.muted, fontSize: 34, fontWeight: 600 }}
          >
            {scene.subtitle}
          </div>
        </div>
      </Enter>
    </AbsoluteFill>
  );
};
