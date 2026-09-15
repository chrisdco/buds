import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";

// Full-detent deck: the Uber-style trip card — room facts plus the action
// deck (navigate / re-center / invite / settings) so expanded controls never
// hide behind the sheet. All data comes from stores; no new logic.
interface RoomDetailsProps {
  code: string;
  travelerCount: number;
  spectatorCount: number;
  expiryLabel: string | null;
  destLabel: string | null;
  copied: boolean;
  onCopyCode: () => void;
  canNavigate: boolean;
  onNavigate: () => void;
  onRecenter: () => void;
  onInvite: () => void;
  onSettings: () => void;
}

// Memoized: all props are primitives or stable callbacks, so the 5s
// presence tick skips the whole deck (it only renders at full detent).
export const RoomDetails = memo(function RoomDetails({
  code,
  travelerCount,
  spectatorCount,
  expiryLabel,
  destLabel,
  copied,
  onCopyCode,
  canNavigate,
  onNavigate,
  onRecenter,
  onInvite,
  onSettings,
}: RoomDetailsProps) {
  return (
    <View style={styles.block}>
      <View style={styles.facts}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Copy room code ${code}`}
          onPress={onCopyCode}
        >
          <Text style={styles.code}>{copied ? "Copied!" : code}</Text>
        </Pressable>
        <Text style={styles.fact}>
          {travelerCount} traveler{travelerCount === 1 ? "" : "s"}
          {spectatorCount > 0 ? ` · ${spectatorCount} watching` : ""}
        </Text>
        {destLabel && <Text style={styles.fact}>Heading to {destLabel}</Text>}
        {expiryLabel && <Text style={styles.fact}>{expiryLabel}</Text>}
      </View>
      <View style={styles.actions}>
        {canNavigate && (
          <Button label="Navigate" size="compact" onPress={onNavigate} />
        )}
        <Button label="Re-center map" size="compact" variant="ghost" onPress={onRecenter} />
        <Button label="Invite buds" size="compact" variant="ghost" onPress={onInvite} />
        <Button label="Room settings" size="compact" variant="ghost" onPress={onSettings} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  block: { marginTop: space.sm, paddingBottom: space.md },
  facts: { alignItems: "center", gap: 2, marginBottom: space.sm },
  code: {
    color: colors.accent,
    fontFamily: fontFamily.extraBold,
    fontSize: 20,
    letterSpacing: 4,
    fontVariant: ["tabular-nums"],
  },
  fact: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular },
  actions: { gap: 0 },
});
