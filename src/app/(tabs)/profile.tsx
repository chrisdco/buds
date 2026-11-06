import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";

import { GroupedCard, ListRow, SectionHeader, TabBarClearance } from "@/components/layout";
import { PeepAvatar, PEEP_COUNT, peepIndexFor } from "@/components/PeepAvatar";
import { icons } from "@/components/Symbol";
import { Screen, TextField } from "@/components/ui";
import { colors, space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { typeScale } from "@/constants/typography";
import { useSessionStore } from "@/stores/sessionStore";
import { usePlacesStore } from "@/stores/placesStore";
import { useRecentsStore } from "@/stores/recentsStore";
import { TabScrollView } from "@/features/nav/TabScrollView";
import { AppIconPicker } from "@/features/profile/AppIconPicker";
import { BudsRow, QuickTiles } from "@/features/profile/ProfileSections";
import { frequentBuds } from "@/lib/tripHistory";

// Profile tab in Uber Account grammar: big name + avatar header, three
// square shortcuts, your buds, then grouped rows (name, places, prefs).
// Anonymous identity stays: profile = name + prefs + what this device has
// seen, and the door to Settings (notifications, privacy, support).
export default function ProfileScreen() {
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
  const units = useSessionStore((s) => s.units);
  const focusShowsMe = useSessionStore((s) => s.focusShowsMe);
  const deviceId = useSessionStore((s) => s.deviceId);
  const avatar = useSessionStore((s) => s.avatar);
  const setAvatar = useSessionStore((s) => s.setAvatar);
  const [picking, setPicking] = useState(false);
  const saved = usePlacesStore((s) => s.saved);
  const recents = useRecentsStore((s) => s.recents);
  const buds = frequentBuds(recents ?? []);
  const version = Constants.expoConfig?.version ?? "dev";
  const initial = (displayName.trim().slice(0, 1) || "?").toUpperCase();
  const effectiveFace = avatar === "initial" ? -1 : (avatar ?? peepIndexFor(deviceId || "you"));

  const face = (size: number) =>
    avatar === "initial" ? (
      <View style={[styles.initial, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.initialText, { fontSize: size * 0.4 }]}>{initial}</Text>
      </View>
    ) : (
      <PeepAvatar seed={deviceId || "you"} face={avatar ?? undefined} size={size} testID="profile-avatar" />
    );

  return (
    <Screen>
      <TabScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[typeScale.display, styles.name]} numberOfLines={2} accessibilityRole="header">
            {displayName.trim() || "Your profile"}
          </Text>
          <Pressable
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Change avatar"
            accessibilityState={{ expanded: picking }}
            testID="profile-avatar-edit"
            hitSlop={6}
            onPress={() => setPicking((p) => !p)}
          >
            {face(64)}
          </Pressable>
        </View>
        <Text style={typeScale.rowSub}>Anonymous · no account, just this device</Text>

        {picking && (
          <View style={styles.picker}>
            <Text style={typeScale.rowSub}>Your face on this device</Text>
            <View style={styles.avatarRow}>
              <AvatarPick
                selected={avatar === null}
                label="Use automatic avatar"
                testID="profile-avatar-auto"
                onPress={() => setAvatar(null)}
              >
                <View style={[styles.initial, styles.pickSize]}>
                  <Text style={styles.autoText}>Auto</Text>
                </View>
              </AvatarPick>
              {Array.from({ length: PEEP_COUNT }, (_, i) => (
                <AvatarPick
                  key={i}
                  selected={effectiveFace === i && avatar !== null}
                  label={`Use avatar ${i + 1}`}
                  testID={`profile-avatar-pick-${i}`}
                  onPress={() => setAvatar(i)}
                >
                  <PeepAvatar seed="pick" face={i} size={44} />
                </AvatarPick>
              ))}
              <AvatarPick
                selected={avatar === "initial"}
                label="Use name initial"
                testID="profile-avatar-initial"
                onPress={() => setAvatar("initial")}
              >
                <View style={[styles.initial, styles.pickSize]}>
                  <Text style={styles.initialText}>{initial}</Text>
                </View>
              </AvatarPick>
            </View>
          </View>
        )}

        <QuickTiles
          tiles={[
            {
              key: "trips",
              label: "Trips",
              icon: icons.trips,
              testID: "profile-tile-trips",
              onPress: () => router.navigate("/trips"),
            },
            {
              key: "places",
              label: "Places",
              icon: icons.pin,
              testID: "profile-tile-places",
              onPress: () => router.push("/search"),
            },
            {
              key: "settings",
              label: "Settings",
              icon: icons.settings,
              testID: "profile-tile-settings",
              onPress: () => router.push("/settings"),
            },
          ]}
        />

        {buds.length > 0 && (
          <>
            <SectionHeader title="Your buds" />
            <BudsRow buds={buds} onSelect={(b) => router.push(`/bud/${b.userId}`)} />
          </>
        )}

        <SectionHeader title="Your name" />
        <TextField
          value={displayName}
          onChangeText={(t) => useSessionStore.getState().setDisplayName(t)}
          placeholder="e.g. Chris"
          maxLength={24}
          autoCapitalize="words"
          accessibilityLabel="Your name"
          testID="profile-name"
        />
        <Text style={[typeScale.meta, styles.hint]}>Shown to your buds. No account needed.</Text>

        <SectionHeader title="Saved places" />
        <GroupedCard>
          <ListRow
            icon={icons.home}
            title="Home"
            sub={saved.home?.name ?? "Add a place"}
            chevron
            divider
            testID="profile-saved-home"
            onPress={() => router.push({ pathname: "/search", params: { save: "home" } })}
          />
          <ListRow
            icon={icons.work}
            title="Work"
            sub={saved.work?.name ?? "Add a place"}
            chevron
            testID="profile-saved-work"
            onPress={() => router.push({ pathname: "/search", params: { save: "work" } })}
          />
        </GroupedCard>

        <SectionHeader title="Preferences" />
        <GroupedCard>
          <ListRow
            icon={icons.navigate}
            title="Distance units"
            sub={units === "km" ? "Kilometers" : "Miles"}
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
            divider
            a11yLabel={`Your route in Focus, ${focusShowsMe ? "on" : "off"}. Tap to switch.`}
            testID="profile-focus-me"
            onPress={() => useSessionStore.getState().setFocusShowsMe(!focusShowsMe)}
          />
          <ListRow
            icon={icons.settings}
            title="Settings"
            sub="Notifications, privacy, help"
            chevron
            a11yLabel="Open app settings"
            testID="profile-settings"
            onPress={() => router.push("/settings")}
          />
        </GroupedCard>

        <SectionHeader title="App icon" />
        <AppIconPicker />

        <SectionHeader title="Spread the word" />
        <GroupedCard>
          <ListRow
            icon={icons.share}
            title="Tell a friend about Buds"
            sub="Live location for group trips, no account"
            chevron
            testID="profile-share-app"
            onPress={() =>
              void Share.share({
                message: "I use Buds to see my group live on one map during trips: https://github.com/chrisdco/buds",
              })
            }
          />
        </GroupedCard>
        <Text style={[typeScale.meta, styles.version]}>Buds {version}</Text>
        <TabBarClearance />
      </TabScrollView>
    </Screen>
  );
}

function AvatarPick({
  selected,
  label,
  testID,
  onPress,
  children,
}: {
  selected: boolean;
  label: string;
  testID: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      // Border always present (transparent when idle) so selection never
      // re-lays-out the row.
      style={({ pressed }) => [styles.pick, selected && styles.pickSelected, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      hitSlop={4}
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    marginTop: space.lg,
  },
  name: { flex: 1, flexShrink: 1 },
  initial: { backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  initialText: { color: colors.text, fontFamily: fontFamily.bold, fontSize: 18 },
  autoText: { color: colors.textDim, fontFamily: fontFamily.semiBold, fontSize: 12 },
  pickSize: { width: 44, height: 44, borderRadius: 22 },
  picker: { marginTop: space.md, gap: space.sm },
  avatarRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  pick: { padding: 2, borderRadius: 26, borderWidth: 2, borderColor: "transparent" },
  pickSelected: { borderColor: colors.text },
  hint: { marginTop: space.sm },
  version: { textAlign: "center", marginTop: space.lg },
});
