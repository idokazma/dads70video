import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/fonts";
import { config } from "./config";
import { STORY } from "./photos";
import { PhotoSlide } from "./PhotoSlide";
import { TitleCard } from "./TitleCard";

// Fonts are bundled in public/fonts so rendering works offline.
loadFont({ family: "Playfair Display", url: staticFile("fonts/PlayfairDisplay.woff2"), weight: "400 900" });
loadFont({ family: "Montserrat", url: staticFile("fonts/Montserrat-500.woff2"), weight: "500" });

const f = (s: number) => Math.round(s * config.fps);

// Every segment overlaps the next by transitionSeconds and crossfades.
// (Flat <Sequence>s rather than <TransitionSeries>, which nests per transition
// and overflows the stack with hundreds of photos.)
const segments = () => [
  { key: "intro", frames: f(config.introSeconds), el: <TitleCard big="70" title={config.introTitle} subtitle={config.introSubtitle} /> },
  ...STORY.map((item, i) =>
    item.kind === "chapter"
      ? { key: `ch${i}`, frames: f(config.chapterSeconds), el: <TitleCard title={item.title} subtitle={item.sub} small /> }
      : { key: item.photo.src, frames: f(config.secondsPerPhoto), el: <PhotoSlide photo={item.photo} index={i} /> },
  ),
  { key: "outro", frames: f(config.outroSeconds), el: <TitleCard title={config.outroTitle} subtitle={config.outroSubtitle} /> },
];

export const totalFrames = () => {
  const segs = segments();
  return segs.reduce((a, s) => a + s.frames, 0) - (segs.length - 1) * f(config.transitionSeconds);
};

const FadeIn: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: frames ? interpolate(frame, [0, frames], [0, 1], { extrapolateRight: "clamp" }) : 1 }}>{children}</AbsoluteFill>;
};

export const Birthday: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const overlap = f(config.transitionSeconds);
  let from = 0;
  const seqs = segments().map((s, i) => {
    const start = from;
    from += s.frames - overlap;
    return (
      <Sequence key={s.key} from={start} durationInFrames={s.frames} premountFor={30}>
        <FadeIn frames={i === 0 ? 0 : overlap}>{s.el}</FadeIn>
      </Sequence>
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: config.background }}>
      {seqs}
      {config.music && (
        <Audio
          src={staticFile(config.music)}
          volume={(fr) =>
            config.musicVolume *
            interpolate(fr, [0, 30, durationInFrames - 90, durationInFrames], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      )}
    </AbsoluteFill>
  );
};
