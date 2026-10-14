import React, { useMemo } from "react";
import { AbsoluteFill, Series } from "remotion";
import { BRAND, REEL, SAFE_AREA } from "../brand";
import { CodeTransition } from "../code/CodeTransition";
import { Enter } from "../components/Enter";
import { codeFontFamily, codeFontSize, uiFontFamily } from "../fonts";
import { CodeSceneData } from "../schema";
import { useThemeColors } from "../theme";
import { clamp, headlineFontSize, wrapText } from "../utils";

const PANEL_PADDING_X = 40;
const PANEL_PADDING_Y = 44;
const PANEL_MIN_HEIGHT = 260;

/** Split a scene's frames across its snippets without losing/adding frames. */
const distributeFrames = (total: number, count: number): number[] => {
  const safeTotal = Math.max(total, count);
  const base = Math.floor(safeTotal / count);
  const frames = Array.from({ length: count }, () => base);
  frames[count - 1] += safeTotal - base * count;
  return frames;
};

const dot: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 999,
  display: "inline-block",
};

const dotColors = ["#ff5f57", "#febc2e", "#28c840"];

export const CodeScene: React.FC<{ readonly scene: CodeSceneData }> = ({
  scene,
}) => {
  const themeColors = useThemeColors();
  const steps = scene.steps;

  const headingLines = wrapText(scene.heading, 22);
  const headingSize = headlineFontSize(headingLines.length, {
    max: 72,
    min: 48,
  });

  const stepFrames = useMemo(() => {
    const custom = scene.stepDurations;
    if (
      custom &&
      custom.length === steps.length &&
      custom.reduce((sum, frames) => sum + frames, 0) === scene.durationInFrames
    ) {
      return custom;
    }
    return distributeFrames(scene.durationInFrames, steps.length);
  }, [scene.durationInFrames, scene.stepDurations, steps.length]);

  const transitionDuration = Math.min(
    30,
    Math.max(10, Math.round(Math.min(...stepFrames) / 3)),
  );

  // Longest line decides the code font size so nothing overflows the panel.
  const maxChars = useMemo(() => {
    const lines = steps.flatMap((step) => step.code.split("\n"));
    return Math.max(
      1,
      ...lines.map((line) => line.replaceAll("\t", "   ").length),
    );
  }, [steps]);

  const availableWidth =
    REEL.width - SAFE_AREA.paddingX * 2 - PANEL_PADDING_X * 2;
  const fontSize = clamp(
    Math.floor(availableWidth / (maxChars * 0.62)),
    16,
    codeFontSize,
  );

  return (
    <AbsoluteFill
      style={{
        padding: `${SAFE_AREA.paddingTop}px ${SAFE_AREA.paddingX}px ${SAFE_AREA.paddingBottom}px`,
        justifyContent: "center",
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
            marginBottom: 24,
            fontFamily: uiFontFamily,
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
            marginBottom: 44,
            fontFamily: uiFontFamily,
          }}
        >
          {headingLines.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      </Enter>

      <Enter delay={6}>
        <div
          style={{
            position: "relative",
            backgroundColor: themeColors.background,
            borderRadius: 28,
            border: `2px solid ${BRAND.grid}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "24px 32px",
              borderBottom: `2px solid ${BRAND.grid}`,
            }}
          >
            {dotColors.map((color) => (
              <span key={color} style={{ ...dot, backgroundColor: color }} />
            ))}
          </div>

          <div
            style={{
              padding: `${PANEL_PADDING_Y}px ${PANEL_PADDING_X}px`,
              position: "relative",
              minHeight: PANEL_MIN_HEIGHT,
            }}
          >
            <Series>
              {steps.map((step, index) => (
                <Series.Sequence
                  key={index}
                  durationInFrames={stepFrames[index]}
                  layout="none"
                  name={step.meta || step.lang}
                >
                  <CodeTransition
                    oldCode={index > 0 ? steps[index - 1] : null}
                    newCode={step}
                    durationInFrames={transitionDuration}
                    fontSize={fontSize}
                  />
                  {step.meta ? (
                    <div
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 0,
                        fontSize: 20,
                        color: BRAND.muted,
                        fontFamily: codeFontFamily,
                      }}
                    >
                      {step.meta}
                    </div>
                  ) : null}
                </Series.Sequence>
              ))}
            </Series>
          </div>
        </div>
      </Enter>
    </AbsoluteFill>
  );
};
