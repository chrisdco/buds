import { Image } from "react-native";

// DestinationArt — pre-rasterized Open Doodles scene (CC0) (see illustration notes in
// docs/design.md). Source: assets/illustrations/src/destination.svg;
// regenerate with `node scripts/rasterize-art.mjs`. One native view.
export function DestinationArt({ width = 240 }: { width?: number }) {
  return (
    <Image
      source={require("../../../assets/illustrations/destination.png")}
      style={{ width, aspectRatio: 888.4 / 760.8 }}
      resizeMode="contain"
      accessible={false}
    />
  );
}
