import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";

import { Button, Chip, ErrorText, Label, Screen, TextField, Title } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { NOTIFY_CATEGORY_LABELS } from "@/events/notifyPrefs";
import { getRecentRooms, pruneRecentRoom, setActiveRoom, type ActiveRoomRef } from "@/lib/activeRoom";
import { roomsRpc } from "@/services/rpc/rooms";
import { ALL_NOTIFY_CATEGORIES, useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

// App-level settings home (avatar entry on home). Per-room controls live in
// room/[id]/settings. Anonymous identity stays: profile = name + prefs.
export default function AppSettingsScreen() {
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
  const units = useSessionStore((s) => s.units);
  const notifyPrefs = useSessionStore((s) => s.notifyPrefs);
  const [recents, setRecents] = useState<ActiveRoomRef[]>([]);
  const [osNotifGranted, setOsNotifGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"reset" | "wipe" | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getRecentRooms().then(setRecents);
      void Notifications.getPermissionsAsync()
        .then((p) => setOsNotifGranted(p.granted))
        .catch(() => setOsNotifGranted(null));
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

  const resetIdentity = () => {
    void (async () => {
      const ok = await useUiStore.getState().requestConfirm({
        title: "Reset identity?",
        body: "You'll get a fresh anonymous identity. Your rooms stay, but you'll rejoin as someone new.",
        confirmLabel: "Reset",
        destructive: true,
      });
      if (!ok) return;
      setBusyAction("reset");
      setError(null);
      try {
        await useSessionStore.getState().resetIdentity();
        useUiStore.getState().pushAlerts([{ id: "identity-reset", severity: "info", title: "New identity issued" }]);
      } catch {
        setError("Couldn't reset identity — check your connection.");
      } finally {
        setBusyAction(null);
      }
    })();
  };

  const wipeData = () => {
    void (async () => {
      const ok = await useUiStore.getState().requestConfirm({
        title: "Delete everything?",
        body: "Leaves all your rooms and wipes this device's Buds data. This can't be undone.",
        confirmLabel: "Delete everything",
        destructive: true,
      });
      if (!ok) return;
      setBusyAction("wipe");
      setError(null);
      try {
        await useSessionStore.getState().wipeAllData((roomId) => roomsRpc.leaveRoom(roomId));
        router.replace("/");
      } catch {
        setError("Couldn't finish wiping — check your connection.");
        setBusyAction(null);
      }
    })();
  };

  const sendFeedback = () => {
    void Share.share({ message: "Buds feedback:\n" });
  };

  const version = Constants.expoConfig?.version ?? "dev";

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title>Settings</Title>

        <Label>Profile</Label>
        <Text style={styles.caption}>Your display name — no account needed.</Text>
        <TextField
          value={displayName}
          onChangeText={(t) => useSessionStore.getState().setDisplayName(t)}
          placeholder="e.g. Chris"
          maxLength={24}
          autoCapitalize="words"
          testID="app-settings-name"
        />
        <Button
          label="Reset identity"
          variant="ghost"
          busy={busyAction === "reset"}
          testID="app-settings-reset-identity"
          onPress={resetIdentity}
        />
        <Button
          label="Delete my data"
          variant="danger"
          busy={busyAction === "wipe"}
          testID="app-settings-wipe"
          onPress={wipeData}
        />

        <Label>Notifications</Label>
        <Text style={styles.caption}>
          Background alerts per category. In-app toasts always show.
        </Text>
        {ALL_NOTIFY_CATEGORIES.map((c) => (
          <View key={c} style={styles.flatRow}>
            <Text style={styles.rowText}>{NOTIFY_CATEGORY_LABELS[c]}</Text>
            <Switch
              value={notifyPrefs[c]}
              testID={`app-settings-notify-${c}`}
              onValueChange={(v) => useSessionStore.getState().setNotifyPref(c, v)}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.text}
            />
          </View>
        ))}
        <View style={styles.flatRow}>
          <Text style={styles.rowText}>
            {osNotifGranted == null
              ? "System notifications: unknown"
              : osNotifGranted
                ? "System notifications: on"
                : "System notifications: off"}
          </Text>
          {osNotifGranted === false && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open system settings"
              hitSlop={12}
              onPress={() => void Linking.openSettings()}
            >
              <Text style={styles.link}>Open Settings</Text>
            </Pressable>
          )}
        </View>

        <Label>Units</Label>
        <View style={styles.chips}>
          <Chip
            label="Kilometers"
            selected={units === "km"}
            testID="app-settings-units-km"
            onPress={() => useSessionStore.getState().setUnits("km")}
          />
          <Chip
            label="Miles"
            selected={units === "mi"}
            testID="app-settings-units-mi"
            onPress={() => useSessionStore.getState().setUnits("mi")}
          />
        </View>

        <Label>Recent trips</Label>
        {recents.length === 0 ? (
          <Text style={styles.caption}>No trips yet — create or join a room first.</Text>
        ) : (
          recents.map((r) => (
            <Pressable
              key={r.id}
              style={styles.tripRow}
              accessibilityRole="button"
              accessibilityLabel={`Rejoin ${r.name}`}
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

        <Label>How it works</Label>
        <Text style={styles.body}>
          Create a room, share the code, and see each other move on one live
          map. Set a destination together, get arrival and separation alerts,
          and leave anytime — rooms auto-close when they expire.
        </Text>

        <Label>FAQ</Label>
        <Text style={styles.body}>
          Who sees my location? Only members of rooms you join, only while you
          share.{"\n\n"}Does it drain battery? Foreground sharing sips;
          screen-off sharing uses more — toggle it per trip.{"\n\n"}Do I need
          an account? No. Your identity is anonymous to this device.
        </Text>

        <Label>Support</Label>
        <Button label="Send feedback" variant="ghost" onPress={sendFeedback} />
        <Text style={styles.caption}>Buds {version} · MIT open source</Text>
        <Pressable onPress={() => void Linking.openURL("https://github.com/chrisdco/buds").catch(() => {})}>
          <Text style={styles.link}>github.com/chrisdco/buds</Text>
        </Pressable>

        <Button label="Back" variant="ghost" onPress={() => router.back()} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 2 },
  body: { color: colors.text, fontSize: 14, fontFamily: fontFamily.regular, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  flatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.sm + space.xs,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { color: colors.text, fontSize: 14, fontFamily: fontFamily.regular, flexShrink: 1, marginRight: 10 },
  link: { color: colors.accent, fontSize: 14, fontFamily: fontFamily.medium, padding: 4 },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.sm + space.xs,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tripName: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semiBold, flexShrink: 1 },
  tripCode: { color: colors.accent, fontSize: 13, fontFamily: fontFamily.bold, letterSpacing: 1 },
});
