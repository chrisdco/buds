import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { GroupedCard, ListRow, SectionHeader, TabBarClearance } from "@/components/layout";
import { PeepAvatar, PEEP_COUNT, peepIndexFor } from "@/components/PeepAvatar";
import { icons } from "@/components/Symbol";
import { Screen, TextField } from "@/components/ui";
import { space } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";

import { useSessionStore } from "@/stores/sessionStore";
import { usePlacesStore } from "@/stores/placesStore";
import { useRecentsStore } from "@/stores/recentsStore";
import { TabScrollView } from "@/features/nav/TabScrollView";
import { BudsRow, QuickTiles } from "@/features/profile/ProfileSections";
import { frequentBuds } from "@/lib/tripHistory";
import { makeStyles, useTypeScale } from "@/theme";

// Profile tab in Uber Account grammar: big name + avatar header, three
// square shortcuts, your buds, your name and saved places. Only what is
// "you" lives here; every preference (look, units, alerts, data) is in
// Settings, one tap away on the Settings tile.
export default function ProfileScreen() {
  const styles = useStyles();
  const typeScale = useTypeScale();
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
  const deviceId = useSessionStore((s) => s.deviceId);
  const avatar = useSessionStore((s) => s.avatar);
  const setAvatar = useSessionStore((s) => s.setAvatar);
  const [picking, setPicking] = useState(false);
  const saved = usePlacesStore((s) => s.saved);
  const recents = useRecentsStore((s) => s.recents);
  const buds = frequentBuds(recents ?? []);
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
  const styles = useStyles();
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

const useStyles = makeStyles((colors) => ({
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
}));
