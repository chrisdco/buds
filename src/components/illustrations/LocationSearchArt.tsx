import { Image } from "react-native";

// LocationSearchArt — pre-rasterized unDraw scene (see illustration notes in
// docs/design.md). Source: assets/illustrations/src/location-search.svg;
// regenerate with `node scripts/rasterize-art.mjs`. One native view.
export function LocationSearchArt({ width = 240 }: { width?: number }) {
  return (
    <Image
      source={require("../../../assets/illustrations/location-search.png")}
      style={{ width, aspectRatio: 960 / 745.55 }}
      resizeMode="contain"
      accessible={false}
    />
  );
}
