import { Image } from "react-native";

// TravelTogetherArt — pre-rasterized Open Doodles scene (CC0) (see illustration notes in
// docs/design.md). Source: assets/illustrations/src/travel-together.svg;
// regenerate with `node scripts/rasterize-art.mjs`. One native view.
export function TravelTogetherArt({ width = 240 }: { width?: number }) {
  return (
    <Image
      source={require("../../../assets/illustrations/travel-together.png")}
      style={{ width, aspectRatio: 802.1 / 778.1 }}
      resizeMode="contain"
      accessible={false}
    />
  );
}
