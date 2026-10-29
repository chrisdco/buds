import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { IconTile, ListRow, NavHeader, SelectableRow, StickyFooter } from "@/components/layout";
import { AppSymbol, icons } from "@/components/Symbol";
import { Button, Chip, ErrorText, Screen, TextField } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { typeScale } from "@/constants/typography";
import { setActiveRoom } from "@/lib/activeRoom";
import { TRIP_PRESETS, parseCreateParams } from "@/lib/tripPresets";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";
import type { RoomMode, RpcError } from "@/types/contracts";

// Uber ride-list grammar: icon left, name + one line of meta, the popular
// option badged. Internal maturity flags stay out of the UI.
const MODES: {
  id: RoomMode;
  label: string;
  blurb: string;
  tag?: string;
  icon: (typeof icons)[keyof typeof icons];
}[] = [
  { id: "converge", label: "Converge", blurb: "Everyone heads to one shared destination.", tag: "Popular", icon: icons.flag },
  { id: "leader", label: "Follow leader", blurb: "One leader, everyone keeps up.", icon: icons.star },
  { id: "formation", label: "Formation", blurb: "Stay within a set radius of the group.", icon: icons.group },
  { id: "multitrack", label: "Multi-track", blurb: "Each traveler has their own destination.", icon: icons.trips },
  { id: "solo", label: "Solo", blurb: "Just share where you are. Others can watch.", icon: icons.profile },
];

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: "No limit", hours: null },
  { label: "4h", hours: 4 },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
];

function createErrorMessage(error: RpcError): string {
  switch (error) {
    case "bad_name":
      return "Room name must be 1–60 characters.";
    case "bad_display_name":
      return "Your name must be 1–24 characters.";
    case "bad_limit":
      return "Traveler limit must be between 1 and 10.";
    case "bad_expiry":
      return "That expiry time isn't valid.";
    case "bad_mode":
      return "That mode isn't supported.";
    default:
      return `Could not create the room (${error}).`;
  }
}

export default function CreateRoomScreen() {
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
  // Trip templates arrive as validated params (Trips tab cards); direct
  // entry falls back to the standard defaults. Prefilled values stay fully
  // editable — presets suggest, never lock.
  const rawParams = useLocalSearchParams();
  const preset = parseCreateParams(rawParams);
  const presetTitle = TRIP_PRESETS.find((p) => p.id === rawParams.preset)?.title;
  const [name, setName] = useState(
    preset.name ?? (displayName.trim() ? `${displayName.trim()}'s trip` : "Our trip"),
  );
  const [mode, setMode] = useState<RoomMode>(preset.mode);
  const [limit, setLimit] = useState(preset.limit);
  const [durationHours, setDurationHours] = useState<number | null>(preset.durationHours);
  const [dest, setDest] = useState(preset.dest);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Double-submit guard: a second tap before the first RPC round-trips
  // would otherwise create two rooms (the `busy` state lags one render).
  const busyRef = useRef(false);

  const create = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const expiresAt =
        durationHours != null
          ? new Date(Date.now() + durationHours * 3_600_000).toISOString()
          : null;
      const result = await roomsRpc.createRoom({
        name: name.trim() || "Our trip",
        displayName: displayName.trim() || "Anonymous",
        mode,
        travelerLimit: limit,
        expiresAt,
      });
      if (!result.ok) {
        setError(createErrorMessage(result.error));
        return;
      }
      setActiveRoom({
        id: result.room.id,
        code: result.room.code,
        name: result.room.name,
        role: "traveler",
      });
      // Home-search pick: seed the room's adjust-pin flow (camera flies,
      // same policy gates + confirm) instead of setting silently.
      if (dest) {
        useUiStore.getState().setDestDraft({ ...dest });
      }
      router.replace(`/room/${result.room.id}`);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const modeLabel = MODES.find((m) => m.id === mode)?.label ?? "";
  const summary = `${limit} traveler${limit === 1 ? "" : "s"} · ${
    durationHours == null ? "no expiry" : `expires in ${durationHours}h`
  }`;

  return (
    <Screen>
      <NavHeader title={presetTitle ? `${presetTitle} trip` : "New room"} />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          value={name}
          onChangeText={setName}
          maxLength={60}
          placeholder="Room name"
          returnKeyType="done"
          accessibilityLabel="Room name"
          testID="create-name"
        />

        {dest && (
          <View style={styles.destCard}>
            <ListRow
              icon={icons.pin}
              title={dest.label}
              sub="Fine-tune the pin after creating"
              trailing={
                <Pressable
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove destination ${dest.label}`}
                  testID="create-dest-clear"
                  hitSlop={8}
                  onPress={() => setDest(undefined)}
                >
                  <AppSymbol
                    name={icons.close}
                    fallback={icons.close.fallback}
                    size={20}
                    tintColor={colors.textDim}
                  />
                </Pressable>
              }
            />
          </View>
        )}

        <Text style={[typeScale.sheetTitle, styles.chooseTitle]} accessibilityRole="header">
          Choose a mode
        </Text>
        <View accessibilityRole="radiogroup">
          {MODES.map((m) => (
            <SelectableRow
              key={m.id}
              title={m.label}
              meta={m.blurb}
              badge={m.tag ?? null}
              selected={m.id === mode}
              leading={<IconTile icon={m.icon} round />}
              a11yHint={m.blurb}
              testID={`create-mode-${m.id}`}
              onPress={() => setMode(m.id)}
            />
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={typeScale.rowTitle}>Travelers</Text>
            <Text style={typeScale.rowSub}>Who can share location. Spectators unlimited.</Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Decrease traveler limit"
              accessibilityHint={`Currently ${limit} of 10`}
              testID="create-limit-minus"
              hitSlop={8}
              onPress={() => setLimit((v) => Math.max(1, v - 1))}
            >
              <AppSymbol name={icons.minus} fallback={icons.minus.fallback} size={18} tintColor={colors.text} />
            </Pressable>
            <Text
              style={[typeScale.value, styles.stepValue]}
              accessibilityLabel={`${limit} travelers`}
              testID="create-limit-value"
            >
              {limit}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Increase traveler limit"
              accessibilityHint={`Currently ${limit} of 10`}
              testID="create-limit-plus"
              hitSlop={8}
              onPress={() => setLimit((v) => Math.min(10, v + 1))}
            >
              <AppSymbol name={icons.plus} fallback={icons.plus.fallback} size={18} tintColor={colors.text} />
            </Pressable>
          </View>
        </View>

        <Text style={[typeScale.rowTitle, styles.expiresTitle]}>Room expires</Text>
        <View style={styles.chips}>
          {DURATIONS.map((d) => (
            <Chip
              key={d.label}
              label={d.label}
              selected={d.hours === durationHours}
              testID={`create-duration-${d.label.replace(/\s+/g, "").toLowerCase()}`}
              a11yLabel={`Expire after ${d.label}`}
              onPress={() => setDurationHours(d.hours)}
            />
          ))}
        </View>
        <ErrorText>{error}</ErrorText>
      </ScrollView>

      {/* Uber "Choose Auto": one pinned CTA that names the choice. */}
      <StickyFooter summary={summary}>
        <Button
          label={`Create ${modeLabel} room`}
          busy={busy}
          testID="create-submit"
          onPress={() => void create()}
        />
      </StickyFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  pressed: { opacity: 0.7 },
  destCard: {
    marginTop: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  chooseTitle: { textAlign: "center", marginTop: space.lg, marginBottom: space.sm },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: space.md,
  },
  settingRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64 },
  settingText: { flex: 1, flexShrink: 1, gap: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: { minWidth: 28, textAlign: "center" },
  expiresTitle: { marginTop: space.lg, marginBottom: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", paddingBottom: space.md },
});
