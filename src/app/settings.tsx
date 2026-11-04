import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useCallback, useState } from "react";
import { ScrollView, Share, StyleSheet, Switch, Text } from "react-native";

import { GroupedCard, ListRow, NavHeader, SectionHeader } from "@/components/layout";
import { icons } from "@/components/Symbol";
import { ErrorText, Screen } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { typeScale as ts } from "@/constants/typography";
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

  const version = Constants.expoConfig?.version ?? "dev";

  const sendFeedback = () => {
    void Share.share({ message: `Buds feedback (v${version}):\n` });
  };

  // One destructive action at a time: rows go inert while either runs.
  const busy = busyAction != null;
  const osBlocked = osNotifGranted === false;

  return (
    <Screen>
      <NavHeader title="Settings" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionHeader title="Notifications" style={styles.firstSection} />
        <Text style={[ts.meta, styles.caption]}>
          Background alerts per category. In-app toasts always show.
        </Text>
        <GroupedCard>
          {ALL_NOTIFY_CATEGORIES.map((c) => (
            <ListRow
              key={c}
              title={NOTIFY_CATEGORY_LABELS[c]}
              divider
              trailing={
                <Switch
                  value={notifyPrefs[c]}
                  testID={`app-settings-notify-${c}`}
                  accessibilityLabel={NOTIFY_CATEGORY_LABELS[c]}
                  onValueChange={(v) => useSessionStore.getState().setNotifyPref(c, v)}
                  trackColor={{ true: colors.success, false: colors.raised }}
                  thumbColor={colors.text}
                />
              }
            />
          ))}
          <ListRow
            icon={icons.bell}
            title="System notifications"
            sub={osNotifGranted == null ? "Unknown" : osNotifGranted ? "On" : "Off — tap to open Settings"}
            chevron={osBlocked}
            a11yHint={osBlocked ? "Opens system settings" : undefined}
            onPress={osBlocked ? () => void Linking.openSettings() : undefined}
          />
        </GroupedCard>

        <SectionHeader title="Identity & data" />
        <GroupedCard>
          <ListRow
            icon={icons.reset}
            title="Reset identity"
            sub={busyAction === "reset" ? "Resetting…" : "Rejoin rooms as someone new"}
            divider
            testID="profile-reset-identity"
            onPress={busy ? undefined : resetIdentity}
          />
          <ListRow
            icon={icons.trash}
            title="Delete my data"
            sub={busyAction === "wipe" ? "Deleting…" : "Leave all rooms and wipe this device"}
            destructive
            testID="profile-wipe"
            onPress={busy ? undefined : wipeData}
          />
        </GroupedCard>
        <ErrorText>{error}</ErrorText>

        <SectionHeader title="How it works" />
        <Text style={ts.body}>
          Create a room, share the code, and see each other move on one live
          map. Set a destination together, get arrival and separation alerts,
          and leave anytime — rooms auto-close when they expire.
        </Text>

        <SectionHeader title="FAQ" />
        <Text style={[ts.rowTitle, styles.question]}>Who sees my location?</Text>
        <Text style={ts.rowSub}>Only members of rooms you join, only while you share.</Text>
        <Text style={[ts.rowTitle, styles.question]}>Does it drain battery?</Text>
        <Text style={ts.rowSub}>
          Foreground sharing sips; screen-off sharing uses more — toggle it per trip.
        </Text>
        <Text style={[ts.rowTitle, styles.question]}>Do I need an account?</Text>
        <Text style={ts.rowSub}>No. Your identity is anonymous to this device.</Text>

        <SectionHeader title="Support" />
        <GroupedCard>
          <ListRow icon={icons.feedback} title="Send feedback" chevron divider onPress={sendFeedback} />
          <ListRow
            icon={icons.link}
            title="Source code"
            sub="github.com/chrisdco/buds"
            chevron
            onPress={() => void Linking.openURL("https://github.com/chrisdco/buds").catch(() => {})}
          />
        </GroupedCard>
        <Text style={[ts.meta, styles.version]}>Buds {version}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  firstSection: { marginTop: space.sm },
  caption: { marginBottom: space.sm },
  question: { marginTop: space.md, marginBottom: 2 },
  version: { textAlign: "center", marginTop: space.lg, marginBottom: space.xl },
});
