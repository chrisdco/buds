import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";

import { PeepA } from "./illustrations/PeepA";
import { PeepC } from "./illustrations/PeepC";
import { PeepD } from "./illustrations/PeepD";
import { PeepE } from "./illustrations/PeepE";
import { PeepF } from "./illustrations/PeepF";
import { PeepG } from "./illustrations/PeepG";
import { PeepH } from "./illustrations/PeepH";

// Deterministic Open Peeps faces (CC0): the same id always renders the same
// face, so members stay recognizable across the member list, profile, and
// create screen. White-on-ink remap baked at conversion (see illustration
// notes in docs/design.md); the medallion paint never mutates, so the
// Fabric background/radius pitfall behind the old tab pill can't recur.
const PEEPS = [PeepA, PeepC, PeepD, PeepE, PeepF, PeepG, PeepH];

function indexFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % PEEPS.length;
}

export const PEEP_COUNT = PEEPS.length;

/** Face index for a seed (member cards + auto profile face). */
export function peepIndexFor(seed: string): number {
  return indexFor(seed);
}

export function PeepAvatar({
  seed,
  face,
  size = 40,
  testID,
}: {
  seed: string;
  /** Explicit face index (picker/trio). Defaults to hash of seed. */
  face?: number;
  size?: number;
  testID?: string;
}) {
  const i =
    face === undefined
      ? indexFor(seed)
      : ((face % PEEPS.length) + PEEPS.length) % PEEPS.length;
  const Peep = PEEPS[i];
  return (
    <View
      style={[styles.medallion, { width: size, height: size, borderRadius: size / 2 }]}
      testID={testID}
      accessible={false}
    >
      <View style={[styles.crop, { width: size, height: size }]}>
        <Peep width={size} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  medallion: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    alignItems: "center",
  },
  // Busts are portrait (head at top): top-align the art so the crop keeps
  // the face, not the torso.
  crop: { overflow: "hidden", justifyContent: "flex-start" },
});
