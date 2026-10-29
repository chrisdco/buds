import { Pressable, Text, View } from "react-native";

import { AppSymbol, icons } from "@/components/Symbol";
import { Button } from "@/components/ui";
import { colors } from "@/constants/theme";
import { roomScreenStyles as styles } from "@/features/room/roomScreenStyles";
import type { AdjustDraft } from "@/features/room/useDestinationPicker";

// Map chrome, kept to Uber's minimum: a back circle top-left, the adjust-pin
// card only while picking a spot, and two floating buttons (recenter, SOS).
// Everything else — title, invite, settings, destination, the CTA — lives in
// the sheet. Presentational only; actions arrive as callbacks.

export function BackCircle({ top, onPress }: { top: number; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.backCircle, { top }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Leave room"
      accessibilityHint="Asks before leaving and returning home"
      testID="room-leave"
      hitSlop={6}
      onPress={onPress}
    >
      <AppSymbol name={icons.back} fallback={icons.back.fallback} size={24} tintColor={colors.text} />
    </Pressable>
  );
}

/**
 * Adjust-pin mode: the card names the pick and confirms it; the pin is drawn
 * with its tip on the exact map center (what getCenter() reports), so the
 * saved coordinate is always the one under the pin.
 */
export function AdjustPin({
  top,
  adjust,
  onCancel,
  onConfirm,
}: {
  top: number;
  adjust: AdjustDraft;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <View style={[styles.adjustCard, { top }]}>
        <Text style={styles.adjustLabel} numberOfLines={1}>
          {adjust.label}
        </Text>
        <Text style={styles.adjustHint}>Drag the map to fine-tune the pin</Text>
        <View style={styles.adjustRow}>
          <View style={styles.adjustBtn}>
            <Button label="Cancel" variant="ghost" size="compact" testID="adjust-cancel" onPress={onCancel} />
          </View>
          <View style={styles.adjustBtn}>
            <Button label="Set destination" size="compact" testID="adjust-confirm" onPress={onConfirm} />
          </View>
        </View>
      </View>
      <View style={styles.adjustPin} pointerEvents="none">
        <View style={[styles.pinCircle, { backgroundColor: colors.accent }]}>
          <Text style={styles.pinGlyph}>{"⚑︎"}</Text>
        </View>
        <View style={[styles.pinTip, { borderTopColor: colors.accent }]} />
      </View>
    </>
  );
}

export function RoomFabs(props: {
  bottom: number;
  /** "Following Ana" / "Focusing 3", or null when nothing is focused. */
  focusLabel: string | null;
  focusA11y: string;
  onClearFocus: () => void;
  autoCamera: boolean;
  onRecenter: () => void;
  /** Null hides the SOS button (spectators just watch). */
  sos: { active: boolean; onPress: () => void } | null;
}) {
  return (
    <View style={[styles.fabColumn, { bottom: props.bottom }]} pointerEvents="box-none">
      {props.focusLabel && (
        <Pressable
          style={({ pressed }) => [styles.fab, styles.fabWide, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={props.focusA11y}
          testID="focus-chip"
          onPress={props.onClearFocus}
        >
          <Text style={styles.fabText} numberOfLines={1}>
            {props.focusLabel}
          </Text>
        </Pressable>
      )}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Re-center map on the group"
        accessibilityState={{ selected: props.autoCamera }}
        testID="room-recenter"
        onPress={props.onRecenter}
      >
        <AppSymbol
          name={icons.recenter}
          fallback={icons.recenter.fallback}
          size={22}
          tintColor={props.autoCamera ? colors.accent : colors.text}
        />
      </Pressable>
      {/* Explicit panic action (#45): travelers only, confirm-gated send,
      frictionless cancel. */}
      {props.sos && (
        <Pressable
          style={({ pressed }) => [styles.fab, props.sos!.active && styles.fabSosActive, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={props.sos.active ? "Cancel your SOS alert" : "Send SOS alert to the room"}
          accessibilityHint={props.sos.active ? "Clears the alert for everyone" : "Asks for confirm first"}
          testID="room-sos"
          onPress={props.sos.onPress}
        >
          <AppSymbol
            name={icons.warning}
            fallback={icons.warning.fallback}
            size={22}
            tintColor={props.sos.active ? colors.text : colors.danger}
          />
        </Pressable>
      )}
    </View>
  );
}
