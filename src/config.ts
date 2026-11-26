// Edit these to personalise the video.
export const config = {
  fps: 30,
  width: 1920,
  height: 1080,

  introTitle: "Happy 70th Birthday",
  introSubtitle: "Dad",
  outroTitle: "70 years. We love you.",
  outroSubtitle: "Happy birthday, Dad",

  introSeconds: 5,
  outroSeconds: 6,
  secondsPerPhoto: 4,
  transitionSeconds: 1,

  // Drop an mp3 at public/music.mp3 and set this to "music.mp3".
  music: null as string | null,
  musicVolume: 0.8,

  accent: "#f2c46d", // warm gold
  background: "#14110d",
};
