import { Image } from "react-native";

// DestinationArt — pre-rasterized unDraw scene (see illustration notes in
// docs/design.md). Source: assets/illustrations/src/destination.svg;
// regenerate with `node scripts/rasterize-art.mjs`. One native view.
export function DestinationArt({ width = 240 }: { width?: number }) {
  return (
    <Image
      source={require("../../../assets/illustrations/destination.png")}
      style={{ width, aspectRatio: 1033.241 / 835.664 }}
      resizeMode="contain"
      accessible={false}
    />
  );
}
