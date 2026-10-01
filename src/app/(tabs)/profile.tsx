import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Chip, Label, Screen, TextField, Title } from "@/components/ui";
import { PeepAvatar, PEEP_COUNT, peepIndexFor } from "@/components/PeepAvatar";
import { AppSymbol, icons } from "@/components/Symbol";
import { colors } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";
import { useSessionStore } from "@/stores/sessionStore";

// Profile tab: quick identity prefs (name, units) + the door to Settings.
// Per-room controls live in room/[id]/settings; notifications, the danger
// zone, and about/support live in the stack Settings page. Anonymous
// identity stays: profile = name + prefs, nothing more.
export default function ProfileScreen() {
  const router = useRouter();
  const displayName = useSessionStore((s) => s.displayName);
  const units = useSessionStore((s) => s.units);
  // The tab already says Profile — the heading carries the identity.
  const heading = displayName.trim() || "Profile";
  const deviceId = useSessionStore((s) => s.deviceId);
  const avatar = useSessionStore((s) => s.avatar);
  const setAvatar = useSessionStore((s) => s.setAvatar);
  const initial = (displayName.trim().slice(0, 1) || "?").toUpperCase();
  const effectiveFace =
    avatar === "initial" ? -1 : (avatar ?? peepIndexFor(deviceId || "you"));

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          {avatar === "initial" ? (
            <View style={[styles.initialMedallion, { width: 56, height: 56, borderRadius: 28 }]}>
              <Text style={styles.initialText}>{initial}</Text>
            </View>
          ) : (
            <PeepAvatar
              seed={deviceId || "you"}
              face={avatar ?? undefined}
              size={56}
              testID="profile-avatar"
            />
          )}
          <View style={styles.identityTitle}>
            <Title>{heading}</Title>
          </View>
        </View>

        <Label>Avatar</Label>
        <Text style={styles.caption}>Your face on this device.</Text>
        <View style={styles.avatarRow}>
          <Pressable
            style={({ pressed }) => [
              styles.pick,
              avatar === null && styles.pickSelected,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Use automatic avatar"
            accessibilityHint="Picks a face from this device"
            accessibilityState={{ selected: avatar === null }}
            testID="profile-avatar-auto"
            hitSlop={4}
            onPress={() => setAvatar(null)}
          >
            <View style={[styles.initialMedallion, { width: 44, height: 44, borderRadius: 22 }]}>
              <Text style={styles.autoText}>Auto</Text>
            </View>
          </Pressable>
          {Array.from({ length: PEEP_COUNT }, (_, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.pick,
                effectiveFace === i && avatar !== null && styles.pickSelected,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Use avatar ${i + 1}`}
              accessibilityState={{ selected: effectiveFace === i && avatar !== null }}
              testID={`profile-avatar-pick-${i}`}
              hitSlop={4}
              onPress={() => setAvatar(i)}
            >
              <PeepAvatar seed="pick" face={i} size={44} />
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [
              styles.pick,
              avatar === "initial" && styles.pickSelected,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Use name initial"
            accessibilityState={{ selected: avatar === "initial" }}
            testID="profile-avatar-initial"
            hitSlop={4}
            onPress={() => setAvatar("initial")}
          >
            <View style={[styles.initialMedallion, { width: 44, height: 44, borderRadius: 22 }]}>
              <Text style={styles.initialText}>{initial}</Text>
            </View>
          </Pressable>
        </View>

        <Label>Profile</Label>
        <Text style={styles.caption}>Your display name — no account needed.</Text>
        <TextField
          value={displayName}
          onChangeText={(t) => useSessionStore.getState().setDisplayName(t)}
          placeholder="e.g. Chris"
          maxLength={24}
          autoCapitalize="words"
          testID="profile-name"
        />

        <Label>Units</Label>
        <View style={styles.chips}>
          <Chip
            label="Kilometers"
            selected={units === "km"}
            testID="profile-units-km"
            onPress={() => useSessionStore.getState().setUnits("km")}
          />
          <Chip
            label="Miles"
            selected={units === "mi"}
            testID="profile-units-mi"
            onPress={() => useSessionStore.getState().setUnits("mi")}
          />
        </View>

        <Label>App</Label>
        <Pressable
          style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Open app settings"
          accessibilityHint="Notifications, privacy, support"
          testID="profile-settings"
          onPress={() => router.push("/settings")}
        >
          <AppSymbol
            name={icons.settings}
            fallback={icons.settings.fallback}
            size={20}
            tintColor={colors.textDim}
          />
          <Text style={styles.settingsText}>Settings</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>

        {/* Clearance above the floating tab pill. */}
        <View style={{ height: 110 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { marginTop: 24, marginBottom: 4, flexDirection: "row", alignItems: "center", gap: 14 },
  identityTitle: { flex: 1, flexShrink: 1 },
  initialMedallion: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  initialText: { color: colors.text, fontFamily: fontFamily.bold, fontSize: 18 },
  autoText: { color: colors.textDim, fontFamily: fontFamily.semiBold, fontSize: 12 },
  pressed: { opacity: 0.75 },
  avatarRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  // Border always present (transparent when idle) so selection never
  // re-lays-out the row — same no-mutation rule as the tab pill.
  pick: { padding: 2, borderRadius: 26, borderWidth: 2, borderColor: "transparent" },
  pickSelected: { borderColor: colors.text },
  caption: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.regular, marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsText: { color: colors.text, fontSize: 16, fontFamily: fontFamily.semiBold, flex: 1 },
  chev: { color: colors.textDim, fontSize: 20, fontFamily: fontFamily.regular },
});
