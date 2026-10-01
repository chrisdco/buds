import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorText, Label, Screen, Title, Button } from "@/components/ui";
import { PresetCircles } from "@/features/trips/PresetCircles";
import { WaitingPeepArt } from "@/components/illustrations/WaitingPeepArt";
import { AppSymbol, icons } from "@/components/Symbol";
import { colors } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { setActiveRoom, type ActiveRoomRef } from "@/lib/activeRoom";
import { useRecentsStore } from "@/stores/recentsStore";
import { TRIP_PRESETS, presetCreateParams } from "@/lib/tripPresets";
import { roomsRpc } from "@/services/rpc/rooms";
import { useSessionStore } from "@/stores/sessionStore";

// Trips tab: every room this device created or joined, newest first.
// Rejoin re-validates membership through join_room (idempotent) and prunes
// dead rooms inline — the list never shows a room you can't enter.
export default function TripsScreen() {
  const router = useRouter();
  // Resident recents (loaded once at startup): rows paint on first commit,
  // and focus refetches that change nothing don't re-render at all.
  const recents = useRecentsStore((s) => s.recents);
  const [error, setError] = useState<string | null>(null);
  // Double-tap guard: joinRoom awaits the network, so two rapid taps would
  // otherwise fire duplicate joins and competing replaces.
  const openBusy = useRef(false);

  const startFromTemplate = (presetId: (typeof TRIP_PRESETS)[number]["id"]) => {
    const preset = TRIP_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const displayName = useSessionStore.getState().displayName;
    router.push({ pathname: "/create", params: presetCreateParams(preset, displayName) });
  };

  useFocusEffect(
    useCallback(() => {
      void useRecentsStore.getState().refresh();
    }, []),
  );

  const forgetTrip = (ref: ActiveRoomRef) => {
    void useRecentsStore.getState().remove(ref.id);
  };

  const openTrip = (ref: ActiveRoomRef) => {
    void (async () => {
      if (openBusy.current) return;
      openBusy.current = true;
      try {
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
            void useRecentsStore.getState().remove(ref.id);
          }
          setError(
            result.error === "room_ended" || result.error === "bad_code"
              ? "That room has ended."
              : "Couldn't rejoin the room.",
          );
        }
      } finally {
        openBusy.current = false;
      }
    })();
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Title>Trips</Title>
        </View>
        <Text style={styles.caption}>Start from a template, or pick up where you left off.</Text>

        <Label>Start a trip</Label>
        <PresetCircles onSelect={startFromTemplate} />

        <Label>Recent trips</Label>
        {/* recents === null only before the startup preload resolves: render
        nothing (same black) rather than flashing the empty state. */}
        {recents === null ? null : recents.length === 0 ? (
          <View style={styles.empty} testID="trips-empty">
            {/* Waiting traveler (Open Peeps, CC0, dark-theme remap). */}
            <WaitingPeepArt width={120} />
            <Text style={[styles.caption, styles.emptyCaption]}>
              No trips yet — create or join a room first.
            </Text>
            <View style={styles.emptyActions}>
              <Button
                label="Create a room"
                size="compact"
                testID="trips-empty-create"
                onPress={() => router.push("/create")}
              />
              <Button
                label="Join with code"
                size="compact"
                variant="ghost"
                testID="trips-empty-join"
                onPress={() => router.push("/join")}
              />
            </View>
          </View>
        ) : (
          recents.map((r) => (
            <View key={r.id} style={styles.tripRow}>
              <Pressable
                style={({ pressed }) => [styles.tripMain, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Rejoin ${r.name}`}
                accessibilityHint={`Code ${r.code}, joined as ${r.role}`}
                testID={`trips-rejoin-${r.code}`}
                onPress={() => openTrip(r)}
              >
                <View style={styles.tripIcon}>
                  <AppSymbol
                    name={icons.history}
                    fallback={icons.history.fallback}
                    size={18}
                    tintColor={colors.textDim}
                  />
                </View>
                <View style={styles.tripBody}>
                  <Text style={styles.tripName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.tripCode}>
                    {r.code} · {r.role === "traveler" ? "Traveler" : "Spectator"}
                  </Text>
                </View>
                <Text style={styles.tripChev}>›</Text>
              </Pressable>
              {/* Local forget only (× is text-by-default, law 1): the room
              is untouched, rejoin-by-code keeps working. */}
              <Pressable
                style={({ pressed }) => [styles.tripForget, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${r.name} from recents`}
                accessibilityHint="Removes from this list only, the room stays"
                testID={`trips-forget-${r.code}`}
                hitSlop={12}
                onPress={() => forgetTrip(r)}
              >
                <Text style={styles.tripForgetGlyph}>×</Text>
              </Pressable>
            </View>
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
  header: { marginTop: 24, marginBottom: 4 },
  caption: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 2 },
  empty: { alignItems: "center", marginTop: 12, gap: 8 },
  emptyCaption: { textAlign: "center" },
  emptyActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  pressed: { opacity: 0.75 },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tripMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tripIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  tripBody: { flex: 1, flexShrink: 1 },
  tripName: { color: colors.text, fontSize: 16, fontFamily: fontFamily.semiBold, flexShrink: 1 },
  tripCode: {
    color: colors.accent,
    fontSize: 13,
    fontFamily: fontFamily.bold,
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
    marginTop: 1,
  },
  tripChev: { color: colors.textDim, fontSize: 20, fontFamily: fontFamily.regular },
  tripForget: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  tripForgetGlyph: { color: colors.textDim, fontSize: 22, fontFamily: fontFamily.regular },
});
