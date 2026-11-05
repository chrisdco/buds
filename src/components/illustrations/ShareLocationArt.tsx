import { Image } from "react-native";

// ShareLocationArt — pre-rasterized Open Doodles scene (CC0) (see illustration notes in
// docs/design.md). Source: assets/illustrations/src/share-location.svg;
// regenerate with `node scripts/rasterize-art.mjs`. One native view.
export function ShareLocationArt({ width = 240 }: { width?: number }) {
  return (
    <Image
      source={require("../../../assets/illustrations/share-location.png")}
      style={{ width, aspectRatio: 1007.4 / 668.4 }}
      resizeMode="contain"
      accessible={false}
    />
  );
}
