import { Composition } from "remotion";
import { Birthday, totalFrames } from "./Birthday";
import { config } from "./config";

export const Root: React.FC = () => (
  <Composition
    id="Birthday"
    component={Birthday}
    durationInFrames={totalFrames()}
    fps={config.fps}
    width={config.width}
    height={config.height}
  />
);
