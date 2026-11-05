import { Image } from "react-native";

// OrderRideArt — pre-rasterized Open Doodles scene (CC0) (see illustration notes in
// docs/design.md). Source: assets/illustrations/src/order-ride.svg;
// regenerate with `node scripts/rasterize-art.mjs`. One native view.
export function OrderRideArt({ width = 240 }: { width?: number }) {
  return (
    <Image
      source={require("../../../assets/illustrations/order-ride.png")}
      style={{ width, aspectRatio: 999.0 / 767.0 }}
      resizeMode="contain"
      accessible={false}
    />
  );
}
