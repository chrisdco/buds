import { Image, type ImageSourcePropType } from "react-native";

import { useScheme } from "@/theme/context";

// Pre-rasterized Open Doodles scenes (CC0; see illustration notes in
// docs/design.md). Sources live in assets/illustrations/src/; regenerate
// the PNGs with `node scripts/rasterize-art.mjs`. Each scene is one native
// Image with an explicit width AND height (never aspectRatio alone, which
// Android can resolve against the intrinsic size inside clipped parents).
// Each scene ships twice: white ink for dark, black ink for light.

export interface SceneArt {
  (props: { width: number }): React.JSX.Element;
  /** width / height of the content-cropped scene. */
  aspect: number;
}

export function scene(dark: ImageSourcePropType, light: ImageSourcePropType, aspect: number): SceneArt {
  const Art = ({ width }: { width: number }) => (
    <Image
      source={useScheme() === "light" ? light : dark}
      style={{ width, height: width / aspect }}
      resizeMode="contain"
      accessible={false}
    />
  );
  Art.aspect = aspect;
  return Art;
}

/** Largest width that fits the scene inside a w x h box. */
export function fitWidth(art: SceneArt, boxW: number, boxH: number): number {
  return Math.floor(Math.min(boxW, boxH * art.aspect));
}
