import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ListRow } from "@/components/layout";
import { AppSymbol, icons } from "@/components/Symbol";
import { Button } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { typeScale } from "@/constants/typography";
import type { PrimaryAction } from "@/features/room/sheetLogic";

export { primaryAction } from "@/features/room/sheetLogic";

// The room sheet's parts in Uber "Choose a trip" grammar: a real title with
// one meta line (not a 13pt pill), a destination row, the member list (see
// MemberList), room facts as plain rows at full detent, and ONE pinned CTA
// that follows the trip's state.

const ACTION_LABEL: Record<PrimaryAction, string> = {
  checkin: "I'm here",
  navigate: "Navigate",
  setDest: "Set a destination",
  invite: "Invite buds",
};

/** Title block: the room, then one line of live status, then progress. */
export const SheetHeader = memo(function SheetHeader({
  title,
  status,
  meta,
  progress,
  onInvite,
  onSettings,
}: {
  title: string;
  status: string | null;
  meta: string | null;
  progress: { arrived: number; total: number } | null;
  onInvite: () => void;
  onSettings: () => void;
}) {
  const ratio =
    progress && progress.total > 0 ? Math.min(1, Math.max(0, progress.arrived / progress.total)) : null;
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={typeScale.sheetTitle} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {status ? (
            <Text style={[typeScale.rowSub, styles.status]} numberOfLines={2}>
              {status}
            </Text>
          ) : null}
        </View>
        <CircleButton icon={icons.share} label="Invite buds" testID="room-invite" onPress={onInvite} />
        <CircleButton icon={icons.settings} label="Room settings" testID="room-settings" onPress={onSettings} />
      </View>
      {ratio != null && (
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ now: progress!.arrived, max: progress!.total }}
        >
          <View style={[styles.fill, { flex: ratio }]} />
          <View style={{ flex: 1 - ratio }} />
        </View>
      )}
      {meta ? (
        <Text style={[typeScale.meta, styles.meta]} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
});

function CircleButton({
  icon,
  label,
  testID,
  onPress,
}: {
  icon: (typeof icons)[keyof typeof icons];
  label: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={4}
      onPress={onPress}
    >
      <AppSymbol name={icon} fallback={icon.fallback} size={20} tintColor={colors.text} />
    </Pressable>
  );
}

/**
 * "Where to?" inside the sheet: a search-styled row when you may set the
 * destination, a plain row when you're just heading somewhere, nothing for
 * spectators with no destination (Uber hides what you can't do).
 */
export function DestinationRow({
  label,
  canSet,
  onSearch,
}: {
  label: string | null;
  canSet: boolean;
  onSearch: () => void;
}) {
  if (canSet) {
    return (
      <Pressable
        style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={label ? `Change destination, currently ${label}` : "Search for a destination"}
        accessibilityHint="Searches places, then fine-tune the pin"
        testID="room-dest-search"
        onPress={onSearch}
      >
        <AppSymbol name={icons.search} fallback={icons.search.fallback} size={20} tintColor={colors.text} />
        <Text style={[styles.searchText, !label && styles.searchPlaceholder]} numberOfLines={1}>
          {label ?? "Where to?"}
        </Text>
      </Pressable>
    );
  }
  if (!label) return null;
  return <ListRow icon={icons.flag} title={label} sub="Destination" />;
}

/** Full-detent facts + room actions as plain rows (no stacked buttons). */
export const RoomFacts = memo(function RoomFacts({
  code,
  copied,
  travelerCount,
  spectatorCount,
  onCopyCode,
  onInvite,
  onSettings,
  onLeave,
}: {
  code: string;
  copied: boolean;
  travelerCount: number;
  spectatorCount: number;
  onCopyCode: () => void;
  onInvite: () => void;
  onSettings: () => void;
  onLeave: () => void;
}) {
  return (
    <View style={styles.facts}>
      <ListRow
        icon={icons.code}
        title="Room code"
        sub={copied ? "Copied" : "Tap to copy"}
        value={code}
        divider
        onPress={onCopyCode}
        a11yLabel={`Room code ${code}, copy`}
        testID="room-copy-code"
      />
      <ListRow
        icon={icons.group}
        title="Invite buds"
        sub={`${travelerCount} traveler${travelerCount === 1 ? "" : "s"}${
          spectatorCount > 0 ? ` · ${spectatorCount} watching` : ""
        }`}
        chevron
        divider
        onPress={onInvite}
      />
      <ListRow icon={icons.settings} title="Room settings" chevron divider onPress={onSettings} />
      <ListRow
        icon={icons.back}
        title="Leave room"
        destructive
        onPress={onLeave}
        testID="room-leave-row"
      />
    </View>
  );
});

/** The pinned CTA row: one primary + an optional square secondary (Uber's ▢). */
export function SheetFooter({
  action,
  onAction,
  secondary,
}: {
  action: PrimaryAction;
  onAction: () => void;
  secondary?: { label: string; onPress: () => void } | null;
}) {
  return (
    <View style={styles.footerRow}>
      <View style={styles.footerMain}>
        <Button label={ACTION_LABEL[action]} testID={`room-cta-${action}`} onPress={onAction} />
      </View>
      {secondary && (
        <Pressable
          style={({ pressed }) => [styles.square, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={secondary.label}
          testID="room-cta-secondary"
          onPress={secondary.onPress}
        >
          <AppSymbol name={icons.share} fallback={icons.share.fallback} size={22} tintColor={colors.text} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  header: { paddingBottom: space.sm },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  headerText: { flex: 1, flexShrink: 1 },
  status: { marginTop: 2 },
  meta: { marginTop: space.sm },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    flexDirection: "row",
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
    marginTop: space.md,
    overflow: "hidden",
  },
  fill: { backgroundColor: colors.text, borderRadius: 2 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 52,
    marginBottom: space.sm,
  },
  searchText: { color: colors.text, fontSize: 17, fontFamily: fontFamily.semiBold, flex: 1 },
  searchPlaceholder: { color: colors.textDim, fontFamily: fontFamily.medium },
  facts: { marginTop: space.md },
  footerRow: { flexDirection: "row", alignItems: "stretch", gap: space.sm },
  footerMain: { flex: 1 },
  square: {
    width: 56,
    marginTop: 12, // matches Button's outer margin so the two align
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
});
