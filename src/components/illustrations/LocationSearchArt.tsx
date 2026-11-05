import { Image } from "react-native";

// LocationSearchArt — pre-rasterized Open Doodles scene (CC0) (see illustration notes in
// docs/design.md). Source: assets/illustrations/src/location-search.svg;
// regenerate with `node scripts/rasterize-art.mjs`. One native view.
export function LocationSearchArt({ width = 240 }: { width?: number }) {
  return (
    <Image
      source={require("../../../assets/illustrations/location-search.png")}
      style={{ width, aspectRatio: 1000.3 / 687.1 }}
      resizeMode="contain"
      accessible={false}
    />
  );
}
