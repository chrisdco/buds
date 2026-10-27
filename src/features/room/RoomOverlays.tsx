import { Pressable, Text, View } from "react-native";

import { AppSymbol, icons } from "@/components/Symbol";
import { Button } from "@/components/ui";
import { colors } from "@/constants/theme";
import { roomScreenStyles as styles } from "@/features/room/roomScreenStyles";
import type { AdjustDraft } from "@/features/room/useDestinationPicker";

// Map chrome for the room screen: the top bar, the destination entry /
// adjust-pin card, and the floating action column. Presentational only —
// every action arrives as a callback from the screen.

export function RoomTopBar(props: {
  top: number;
  name: string | null;
  subtitle: string;
  onLeave: () => void;
  onCopyCode: () => void;
  onInvite: () => void;
  onSettings: () => void;
}) {
  return (
    <View style={[styles.topBar, { top: props.top }]}>
      <Pressable
        style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Leave room"
        accessibilityHint="Leaves this room and returns home"
        testID="room-leave"
        onPress={props.onLeave}
      >
        <AppSymbol name={icons.back} fallback={icons.back.fallback} size={18} tintColor={colors.text} />
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.titlePill, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Copy room code"
        accessibilityHint="Copies the 6-letter code for sharing"
        testID="room-copy-code"
        onPress={props.onCopyCode}
      >
        <Text style={styles.roomName} numberOfLines={1}>
          {props.name ?? "…"}
        </Text>
        <Text style={styles.roomCode}>{props.subtitle}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Invite buds"
        accessibilityHint="Shows the QR code and share sheet"
        testID="room-invite"
        onPress={props.onInvite}
      >
        <View style={styles.pillRow}>
          <AppSymbol
            name={icons.invite}
            fallback={icons.invite.fallback}
            size={16}
            tintColor={colors.text}
          />
          <Text style={styles.pillButtonText}>Invite</Text>
        </View>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Room settings"
        accessibilityHint="Mode, members, expiry and privacy"
        testID="room-settings"
        onPress={props.onSettings}
      >
        <AppSymbol
          name={icons.settings}
          fallback={icons.settings.fallback}
          size={20}
          tintColor={colors.text}
        />
      </Pressable>
    </View>
  );
}

/**
 * Destination entry + adjust-pin card: Uber "Where to?" grammar. While a pin
 * is being adjusted, the card replaces the search pill and the pin is drawn
 * with its tip on the exact map center (what getCenter() reports), so the
 * saved coordinate is always the one under the pin.
 */
export function DestinationBar(props: {
  top: number;
  adjust: AdjustDraft | null;
  destLabel: string | null;
  canSearch: boolean;
  onSearch: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { adjust } = props;
  return (
    <>
      {!adjust ? (
        <Pressable
          style={({ pressed }) => [
            styles.searchPill,
            { top: props.top },
            pressed && styles.pressed,
            !props.canSearch && styles.searchPillDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            props.destLabel
              ? `Change destination, currently ${props.destLabel}`
              : "Search for a destination"
          }
          accessibilityHint={
            props.canSearch ? "Searches places, then fine-tune the pin" : "Spectators watch only"
          }
          testID="room-dest-search"
          onPress={props.onSearch}
        >
          <AppSymbol
            name={icons.search}
            fallback={icons.search.fallback}
            size={17}
            tintColor={colors.textDim}
          />
          <Text style={styles.searchText} numberOfLines={1}>
            {props.destLabel ?? "Where to?"}
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.adjustCard, { top: props.top }]}>
          <Text style={styles.adjustLabel} numberOfLines={1}>
            {adjust.label}
          </Text>
          <Text style={styles.adjustHint}>Drag the map to fine-tune the pin</Text>
          <View style={styles.adjustRow}>
            <View style={styles.adjustBtn}>
              <Button
                label="Cancel"
                variant="ghost"
                size="compact"
                testID="adjust-cancel"
                onPress={props.onCancel}
              />
            </View>
            <View style={styles.adjustBtn}>
              <Button
                label="Set destination"
                size="compact"
                testID="adjust-confirm"
                onPress={props.onConfirm}
              />
            </View>
          </View>
        </View>
      )}
      {adjust && (
        <View style={styles.adjustPin} pointerEvents="none">
          <View style={[styles.pinCircle, { backgroundColor: colors.accent }]}>
            <Text style={styles.pinGlyph}>{"⚑︎"}</Text>
          </View>
          <View style={[styles.pinTip, { borderTopColor: colors.accent }]} />
        </View>
      )}
    </>
  );
}

export function RoomFabs(props: {
  bottom: number;
  /** "Following Ana" / "Focusing 3", or null when nothing is focused. */
  focusLabel: string | null;
  focusA11y: string;
  onClearFocus: () => void;
  onNavigate: (() => void) | null;
  autoCamera: boolean;
  onRecenter: () => void;
  /** Null hides the SOS button (spectators just watch). */
  sos: { active: boolean; onPress: () => void } | null;
}) {
  return (
    <View style={[styles.fabColumn, { bottom: props.bottom }]}>
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
      {props.onNavigate && (
        <Pressable
          style={({ pressed }) => [styles.fab, styles.fabWide, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Navigate to destination in external maps"
          testID="room-navigate"
          onPress={props.onNavigate}
        >
          <View style={styles.pillRow}>
            <AppSymbol
              name={icons.navigate}
              fallback={icons.navigate.fallback}
              size={17}
              tintColor={colors.text}
            />
            <Text style={styles.fabText}>Navigate</Text>
          </View>
        </Pressable>
      )}
      <Pressable
        style={({ pressed }) => [styles.fab, props.autoCamera && styles.fabActive, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Re-center map on the group"
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
      frictionless cancel. Warning glyph + danger border earn the weight;
      the confirm sheet stops pocket-SOS. */}
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
