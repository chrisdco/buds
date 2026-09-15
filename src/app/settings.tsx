import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";

import { Button, ErrorText, Label, Screen, Title } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { NOTIFY_CATEGORY_LABELS } from "@/events/notifyPrefs";
import { roomsRpc } from "@/services/rpc/rooms";
import { ALL_NOTIFY_CATEGORIES, useSessionStore } from "@/stores/sessionStore";
import { useUiStore } from "@/stores/uiStore";

// App settings (stack page, no tabs per law 12): notification prefs, the
// identity danger zone, about/FAQ, support. Quick prefs (name, units) stay
// on the Profile tab; everything configurational lives here.
export default function SettingsScreen() {
  const router = useRouter();
  const notifyPrefs = useSessionStore((s) => s.notifyPrefs);
  const [osNotifGranted, setOsNotifGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"reset" | "wipe" | null>(null);

  useFocusEffect(
    useCallback(() => {
      void Notifications.getPermissionsAsync()
        .then((p) => setOsNotifGranted(p.granted))
        .catch(() => setOsNotifGranted(null));
    }, []),
  );

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
        <View style={styles.header}>
          <Title>Settings</Title>
        </View>

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

        <Label>Identity & data</Label>
        <Button
          label="Reset identity"
          variant="ghost"
          busy={busyAction === "reset"}
          testID="profile-reset-identity"
          onPress={resetIdentity}
        />
        <Button
          label="Delete my data"
          variant="danger"
          busy={busyAction === "wipe"}
          testID="profile-wipe"
          onPress={wipeData}
        />
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 24, marginBottom: 4 },
  caption: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 2 },
  body: { color: colors.text, fontSize: 14, fontFamily: fontFamily.regular, lineHeight: 20 },
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
});
