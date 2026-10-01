import { Image } from "react-native";

// OrderRideArt — pre-rasterized unDraw scene (see illustration notes in
// docs/design.md). Source: assets/illustrations/src/order-ride.svg;
// regenerate with `node scripts/rasterize-art.mjs`. One native view.
export function OrderRideArt({ width = 240 }: { width?: number }) {
  return (
    <Image
      source={require("../../../assets/illustrations/order-ride.png")}
      style={{ width, aspectRatio: 918.58215 / 432.0506 }}
      resizeMode="contain"
      accessible={false}
    />
  );
}
