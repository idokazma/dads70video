import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { config } from "./config";

export const TitleCard: React.FC<{ title: string; subtitle: string; big?: string; small?: boolean }> = ({ title, subtitle, big, small }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14 } });
  const sub = spring({ frame: frame - 15, fps, config: { damping: 200 } });
  const out = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 40%, #3a2c18 0%, ${config.background} 70%)`,
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        opacity: out,
      }}
    >
      {big && (
        <div
          style={{
            fontFamily: "Playfair Display, serif",
            fontWeight: 700,
            fontSize: 360,
            lineHeight: 1,
            color: config.accent,
            transform: `scale(${0.6 + 0.4 * pop})`,
            opacity: pop,
            textShadow: "0 10px 60px rgba(242,196,109,0.35)",
          }}
        >
          {big}
        </div>
      )}
      <div style={{ fontFamily: "Playfair Display, serif", fontSize: small ? 110 : 96, fontStyle: small ? "italic" : undefined, color: "white", opacity: pop, marginTop: 10 }}>
        {title}
      </div>
      <div
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontSize: 48,
          letterSpacing: 12,
          textTransform: "uppercase",
          color: config.accent,
          marginTop: 30,
          opacity: sub,
          transform: `translateY(${(1 - sub) * 30}px)`,
        }}
      >
        {subtitle}
      </div>
    </AbsoluteFill>
  );
};
