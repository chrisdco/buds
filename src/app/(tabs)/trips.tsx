import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorText, Label, Screen, Title } from "@/components/ui";
import { AppSymbol, icons } from "@/components/Symbol";
import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { getRecentRooms, pruneRecentRoom, setActiveRoom, type ActiveRoomRef } from "@/lib/activeRoom";
import { TRIP_PRESETS, presetCreateParams } from "@/lib/tripPresets";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";

// Trips tab: every room this device created or joined, newest first.
// Rejoin re-validates membership through join_room (idempotent) and prunes
// dead rooms inline — the list never shows a room you can't enter.
export default function TripsScreen() {
  const router = useRouter();
  const [recents, setRecents] = useState<ActiveRoomRef[]>([]);
  const [error, setError] = useState<string | null>(null);

  const startFromTemplate = (presetId: (typeof TRIP_PRESETS)[number]["id"]) => {
    const preset = TRIP_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const displayName = useSessionStore.getState().displayName;
    router.push({ pathname: "/create", params: presetCreateParams(preset, displayName) });
  };

  useFocusEffect(
    useCallback(() => {
      void getRecentRooms().then(setRecents);
    }, []),
  );

  const openTrip = (ref: ActiveRoomRef) => {
    void (async () => {
      setError(null);
      const name = useSessionStore.getState().displayName.trim() || "Anonymous";
      const result = await roomsRpc.joinRoom({ code: ref.code, displayName: name, role: ref.role });
      if (result.ok) {
        setActiveRoom({
          id: result.room.id,
          code: result.room.code,
          name: result.room.name,
          role: result.member.role,
        });
        router.replace(`/room/${result.room.id}`);
      } else {
        if (result.error === "room_ended" || result.error === "bad_code" || result.error === "kicked") {
          await pruneRecentRoom(ref.id);
          setRecents(await getRecentRooms());
        }
        setError(
          result.error === "room_ended" || result.error === "bad_code"
            ? "That room has ended."
            : "Couldn't rejoin the room.",
        );
      }
    })();
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title>Trips</Title>
        <Text style={styles.caption}>Start from a template, or pick up where you left off.</Text>

        <Label>Start a trip</Label>
        <View style={styles.templates}>
          {TRIP_PRESETS.map((preset) => (
            <Pressable
              key={preset.id}
              style={styles.template}
              accessibilityRole="button"
              accessibilityLabel={`Start a ${preset.title} trip`}
              testID={`trips-template-${preset.id}`}
              onPress={() => startFromTemplate(preset.id)}
            >
              <View style={styles.templateIcon}>
                <AppSymbol
                  name={icons[preset.icon]}
                  fallback={icons[preset.icon].fallback}
                  size={22}
                  tintColor={colors.text}
                />
              </View>
              <Text style={styles.templateTitle} numberOfLines={1}>
                {preset.title}
              </Text>
              <Text style={styles.templateBlurb} numberOfLines={2}>
                {preset.blurb}
              </Text>
            </Pressable>
          ))}
        </View>

        <Label>Recent trips</Label>
        {recents.length === 0 ? (
          <Text style={styles.caption} testID="trips-empty">
            No trips yet — create or join a room first.
          </Text>
        ) : (
          recents.map((r) => (
            <Pressable
              key={r.id}
              style={styles.tripRow}
              accessibilityRole="button"
              accessibilityLabel={`Rejoin ${r.name}`}
              testID={`trips-rejoin-${r.code}`}
              onPress={() => openTrip(r)}
            >
              <Text style={styles.tripName} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.tripCode}>{r.code}</Text>
            </Pressable>
          ))
        )}
        <ErrorText>{error}</ErrorText>
        {/* Clearance above the floating tab pill. */}
        <View style={{ height: 110 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 2 },
  templates: { flexDirection: "row", gap: 8 },
  template: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: "center",
    minHeight: 132,
  },
  templateIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  templateTitle: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fontFamily.semiBold,
    marginTop: 8,
    textAlign: "center",
  },
  templateBlurb: {
    color: colors.textDim,
    fontSize: 11,
    fontFamily: fontFamily.regular,
    marginTop: 2,
    textAlign: "center",
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tripName: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semiBold, flexShrink: 1 },
  tripCode: {
    color: colors.accent,
    fontSize: 13,
    fontFamily: fontFamily.bold,
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
  },
});
