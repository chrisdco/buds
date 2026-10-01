import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Chip, ErrorText, Label, Screen, TextField, Title } from "@/components/ui";
import { PeepAvatar } from "@/components/PeepAvatar";
import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { setActiveRoom } from "@/lib/activeRoom";
import { TRIP_PRESETS, parseCreateParams } from "@/lib/tripPresets";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";
import type { RoomMode, RpcError } from "@/types/contracts";

const MODES: { id: RoomMode; label: string; blurb: string; tag?: string }[] = [
  { id: "solo", label: "Solo", blurb: "Just share where you are. Others can watch.", tag: "Experimental" },
  { id: "converge", label: "Converge", blurb: "Everyone heads to one shared destination.", tag: "Popular" },
  { id: "multitrack", label: "Multi-track", blurb: "Each traveler has their own destination.", tag: "Experimental" },
  { id: "leader", label: "Follow leader", blurb: "One leader, everyone keeps up." },
  { id: "formation", label: "Formation", blurb: "Stay within a set radius of the group." },
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
  const deviceId = useSessionStore((s) => s.deviceId);
  const avatar = useSessionStore((s) => s.avatar);
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
      router.replace(`/room/${result.room.id}`);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Title>New room</Title>
        {presetTitle && <Text style={styles.presetHint}>{presetTitle} preset — tweak anything</Text>}
      </View>

      {/* Gather-your-buds strip (Open Peeps faces, fixed seeds): the room
      starts with you, and every seat after that is a bud with a code. */}
      <View style={styles.crew} accessibilityLabel="Gather your buds">
        <View style={styles.crewStack}>
          <PeepAvatar
            seed={deviceId || "you"}
            face={typeof avatar === "number" ? avatar : undefined}
            size={44}
          />
          <View style={styles.crewOverlap}>
            <PeepAvatar seed="buds-crew-b" size={44} />
          </View>
          <View style={styles.crewOverlap}>
            <PeepAvatar seed="buds-crew-c" size={44} />
          </View>
        </View>
        <Text style={styles.crewText}>Gather your buds — they join with your code.</Text>
      </View>

      <Label>Room name</Label>
      <TextField
        value={name}
        onChangeText={setName}
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={() => void create()}
        testID="create-name"
      />

      <Label>Mode</Label>
      <View style={styles.modeList}>
        {MODES.map((m) => {
          const selected = m.id === mode;
          return (
            <Pressable
              key={m.id}
              style={({ pressed }) => [
                styles.modeRow,
                selected && styles.modeRowSelected,
                pressed && styles.pressed,
              ]}
              accessibilityRole="radio"
              accessibilityLabel={m.label}
              accessibilityHint={m.blurb}
              accessibilityState={{ selected }}
              testID={`create-mode-${m.id}`}
              onPress={() => setMode(m.id)}
            >
              <View style={styles.modeBody}>
                <View style={styles.modeTitleRow}>
                  <Text style={[styles.modeTitle, selected && styles.modeTitleSelected]}>
                    {m.label}
                  </Text>
                  {m.tag && (
                    <View style={styles.modeTag}>
                      <Text style={styles.modeTagText}>{m.tag}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.blurb}>{m.blurb}</Text>
              </View>
              <View
                style={[styles.radio, selected && styles.radioSelected]}
                accessibilityElementsHidden
              >
                {selected && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Label>Traveler limit</Label>
      <Text style={styles.caption}>How many people can share location. Spectators are unlimited.</Text>
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
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text
          style={styles.stepValue}
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
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>

      <Label>Room expires after</Label>
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
      <Text style={styles.summary}>
        {limit} traveler{limit === 1 ? "" : "s"} · {MODES.find((m) => m.id === mode)?.label} ·{" "}
        {durationHours == null ? "no expiry" : `${durationHours}h`}
      </Text>
      <Button label="Create room" busy={busy} testID="create-submit" onPress={() => void create()} />
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 24, marginBottom: 4 },
  crew: { flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 4 },
  crewStack: { flexDirection: "row", alignItems: "center" },
  crewOverlap: { marginLeft: -14 },
  crewText: {
    color: colors.textDim,
    fontSize: 13,
    fontFamily: fontFamily.regular,
    flex: 1,
    flexShrink: 1,
    marginLeft: 10,
  },
  caption: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 2 },
  summary: {
    color: colors.textDim,
    fontSize: 13,
    fontFamily: fontFamily.semiBold,
    textAlign: "center",
    marginTop: 12,
  },
  pressed: { opacity: 0.75 },
  presetHint: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  blurb: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 2 },
  modeList: { gap: 8, marginTop: 4 },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modeRowSelected: { borderColor: colors.text },
  modeBody: { flex: 1, flexShrink: 1 },
  modeTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modeTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.semiBold },
  modeTitleSelected: { fontFamily: fontFamily.bold },
  modeTag: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modeTagText: { color: colors.textDim, fontSize: 10, fontFamily: fontFamily.semiBold },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.text },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.text },
  stepper: { flexDirection: "row", alignItems: "center", gap: 18 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: colors.text, fontSize: 22, fontFamily: fontFamily.medium },
  stepValue: {
    color: colors.text,
    fontSize: 20,
    fontFamily: fontFamily.bold,
    minWidth: 28,
    textAlign: "center",
  },
});
