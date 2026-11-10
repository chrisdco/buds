import Constants from "expo-constants";
import { supportsAlternateIcons } from "expo-alternate-app-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useCallback, useState } from "react";
import { ScrollView, Share, Switch, Text } from "react-native";

import { GroupedCard, ListRow, NavHeader, SectionHeader } from "@/components/layout";
import { icons } from "@/components/Symbol";
import { ErrorText, Screen, Segmented } from "@/components/ui";
import { space } from "@/constants/theme";

import { NOTIFY_CATEGORY_LABELS } from "@/events/notifyPrefs";
import { AppIconPicker } from "@/features/profile/AppIconPicker";
import { roomsRpc } from "@/services/rpc/rooms";
import { ALL_NOTIFY_CATEGORIES, useSessionStore } from "@/stores/sessionStore";
import { useThemeStore, type ThemePref } from "@/stores/themeStore";
import { useUiStore } from "@/stores/uiStore";
import { makeStyles, useColors, useTypeScale } from "@/theme";

// App settings (stack page, no tabs per law 12), most-used first: look,
// map, notifications, then data, help and support. Profile keeps only the
// "you" bits (name, face, saved places).
export default function SettingsScreen() {
  const styles = useStyles();
  const colors = useColors();
  const ts = useTypeScale();
  const router = useRouter();
  const notifyPrefs = useSessionStore((s) => s.notifyPrefs);
  const units = useSessionStore((s) => s.units);
  const focusShowsMe = useSessionStore((s) => s.focusShowsMe);
  const themePref = useThemeStore((s) => s.pref);
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
        <SectionHeader title="Appearance" style={styles.firstSection} />
        <Segmented<ThemePref>
          options={THEME_OPTIONS}
          value={themePref}
          onChange={(p) => useThemeStore.getState().setPref(p)}
          testID="profile-theme"
        />
        {supportsAlternateIcons && (
          <>
            <Text style={[ts.meta, styles.subLabel]}>App icon</Text>
            <AppIconPicker />
          </>
        )}

        <SectionHeader title="Map" />
        <GroupedCard>
          <ListRow
            icon={icons.navigate}
            title="Distance units"
            value={units === "km" ? "km" : "mi"}
            divider
            a11yLabel={`Distance units, ${units === "km" ? "kilometers" : "miles"}. Tap to switch.`}
            testID={units === "km" ? "profile-units-km" : "profile-units-mi"}
            onPress={() => useSessionStore.getState().setUnits(units === "km" ? "mi" : "km")}
          />
          <ListRow
            icon={icons.trips}
            title="Your route in Focus"
            sub={focusShowsMe ? "Drawn faintly while you focus on others" : "Hidden while you focus on others"}
            value={focusShowsMe ? "On" : "Off"}
            a11yLabel={`Your route in Focus, ${focusShowsMe ? "on" : "off"}. Tap to switch.`}
            testID="profile-focus-me"
            onPress={() => useSessionStore.getState().setFocusShowsMe(!focusShowsMe)}
          />
        </GroupedCard>

        <SectionHeader title="Notifications" />
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

        <SectionHeader title="Help" />
        <Text style={[ts.rowTitle, styles.question]}>How does it work?</Text>
        <Text style={ts.rowSub}>
          Create a room, share the code, and see each other move on one live map. Leave anytime.
        </Text>
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
            icon={icons.share}
            title="Tell a friend about Buds"
            chevron
            divider
            testID="profile-share-app"
            onPress={() =>
              void Share.share({
                message: "I use Buds to see my group live on one map during trips: https://github.com/chrisdco/buds",
              })
            }
          />
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

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const useStyles = makeStyles(() => ({
  firstSection: { marginTop: space.sm },
  subLabel: { marginTop: space.md, marginBottom: space.sm },
  caption: { marginBottom: space.sm },
  question: { marginTop: space.md, marginBottom: 2 },
  version: { textAlign: "center", marginTop: space.lg, marginBottom: space.xl },
}));
