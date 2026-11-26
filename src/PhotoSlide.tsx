import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import type { Photo } from "./photos";
import { config } from "./config";

// Four gentle "Ken Burns" moves, cycled so consecutive photos differ.
const MOVES = [
  { from: { s: 1.0, x: -1, y: 0 }, to: { s: 1.12, x: 1, y: -1 } },
  { from: { s: 1.12, x: 1, y: 1 }, to: { s: 1.0, x: -1, y: 0 } },
  { from: { s: 1.02, x: 0, y: 1 }, to: { s: 1.14, x: 0, y: -1 } },
  { from: { s: 1.14, x: -1, y: -1 }, to: { s: 1.02, x: 1, y: 1 } },
];

export const PhotoSlide: React.FC<{ photo: Photo; index: number }> = ({ photo, index }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { easing: Easing.inOut(Easing.quad) });
  const m = MOVES[index % MOVES.length];
  const s = m.from.s + (m.to.s - m.from.s) * t;
  const pan = 1.5; // percent
  const x = (m.from.x + (m.to.x - m.from.x) * t) * pan;
  const y = (m.from.y + (m.to.y - m.from.y) * t) * pan;

  const src = staticFile(photo.src);
  const photoAspect = photo.width / photo.height;
  const frameAspect = width / height;
  // Landscape-ish photos fill the frame; portrait / square photos sit on a blurred copy of themselves.
  const fill = photoAspect > frameAspect * 0.85;

  const label = [photo.year, photo.caption].filter(Boolean).join(" · ");
  const labelOpacity = interpolate(frame, [15, 35, durationInFrames - 25, durationInFrames - 5], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: config.background, overflow: "hidden" }}>
      {!fill && (
        <Img
          src={src}
          style={{
            position: "absolute",
            inset: -60,
            width: "calc(100% + 120px)",
            height: "calc(100% + 120px)",
            objectFit: "cover",
            filter: "blur(40px) brightness(0.45) saturate(1.2)",
          }}
        />
      )}
      <AbsoluteFill style={{ transform: `scale(${s}) translate(${x}%, ${y}%)` }}>
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: fill ? "cover" : "contain",
            filter: fill ? undefined : "drop-shadow(0 20px 50px rgba(0,0,0,0.6))",
          }}
        />
      </AbsoluteFill>
      {/* soft vignette */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)" }} />
      {label && (
        <div
          style={{
            position: "absolute",
            left: 80,
            bottom: 70,
            opacity: labelOpacity,
            color: "white",
            fontFamily: "Playfair Display, serif",
            fontSize: 54,
            textShadow: "0 3px 18px rgba(0,0,0,0.8)",
          }}
        >
          {label}
        </div>
      )}
    </AbsoluteFill>
  );
};
