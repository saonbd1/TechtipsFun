import React from "react";
import { AbsoluteFill } from "remotion";
import { BRAND, REEL, SAFE_AREA } from "../brand";
import { Enter } from "../components/Enter";
import { ScreenshotCard } from "../components/ScreenshotCard";
import { uiFontFamily } from "../fonts";
import { PointScene as PointSceneData } from "../schema";
import { headlineFontSize, wrapText } from "../utils";

const CONTENT_WIDTH = REEL.width - SAFE_AREA.paddingX * 2;

/**
 * Point + screenshot: compact heading on top, the article's own image below.
 * The body text is left to the captions so the screenshot gets the space.
 */
const PointWithImage: React.FC<{ readonly scene: PointSceneData }> = ({
  scene,
}) => {
  const headingLines = wrapText(scene.heading, 24);
  const headingSize = headlineFontSize(headingLines.length, {
    max: 66,
    min: 46,
  });
  const contentHeight =
    REEL.height - SAFE_AREA.paddingTop - SAFE_AREA.paddingBottomWithImage;
  const headingBlock = 28 + 22 + headingLines.length * headingSize * 1.08;
  const imageMaxHeight = contentHeight - headingBlock - 40;

  return (
    <AbsoluteFill
      style={{
        padding: `${SAFE_AREA.paddingTop}px ${SAFE_AREA.paddingX}px ${SAFE_AREA.paddingBottomWithImage}px`,
        justifyContent: "center",
        fontFamily: uiFontFamily,
      }}
    >
      <Enter>
        <div
          style={{
            color: BRAND.lime,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 18,
          }}
        >
          {scene.kicker}
        </div>
        <div
          style={{
            color: BRAND.white,
            fontSize: headingSize,
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: -0.8,
            marginBottom: 40,
          }}
        >
          {headingLines.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      </Enter>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <ScreenshotCard
          image={scene.image!}
          maxWidth={CONTENT_WIDTH}
          maxHeight={imageMaxHeight}
          delay={6}
        />
      </div>
    </AbsoluteFill>
  );
};

export const PointScene: React.FC<{ readonly scene: PointSceneData }> = ({
  scene,
}) => {
  if (scene.image) return <PointWithImage scene={scene} />;

  const headingLines = wrapText(scene.heading, 20);
  const headingSize = headlineFontSize(headingLines.length, {
    max: 82,
    min: 54,
  });
  const bodyLines = wrapText(scene.body, 32);

  return (
    <AbsoluteFill
      style={{
        padding: `${SAFE_AREA.paddingTop}px ${SAFE_AREA.paddingX}px ${SAFE_AREA.paddingBottom}px`,
        justifyContent: "center",
        fontFamily: uiFontFamily,
      }}
    >
      <Enter>
        <div
          style={{
            color: BRAND.lime,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 26,
          }}
        >
          {scene.kicker}
        </div>
      </Enter>

      <Enter delay={4}>
        <div
          style={{
            color: BRAND.white,
            fontSize: headingSize,
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: -1,
          }}
        >
          {headingLines.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      </Enter>

      <Enter delay={8}>
        <div
          style={{
            marginTop: 34,
            color: BRAND.muted,
            fontSize: 38,
            lineHeight: 1.35,
            fontWeight: 500,
          }}
        >
          {bodyLines.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      </Enter>
    </AbsoluteFill>
  );
};
