import { Image } from "react-native";

// ShareLocationArt — pre-rasterized unDraw scene (see illustration notes in
// docs/design.md). Source: assets/illustrations/src/share-location.svg;
// regenerate with `node scripts/rasterize-art.mjs`. One native view.
export function ShareLocationArt({ width = 240 }: { width?: number }) {
  return (
    <Image
      source={require("../../../assets/illustrations/share-location.png")}
      style={{ width, aspectRatio: 747.137 / 880 }}
      resizeMode="contain"
      accessible={false}
    />
  );
}
