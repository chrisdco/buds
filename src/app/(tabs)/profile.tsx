import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Chip, Label, Screen, TextField, Title } from "@/components/ui";
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

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Title>{heading}</Title>
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
          style={styles.settingsRow}
          accessibilityRole="button"
          accessibilityLabel="Open app settings"
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
  header: { marginTop: 24, marginBottom: 4 },
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
