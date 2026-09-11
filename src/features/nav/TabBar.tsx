import { useRouter, useSegments } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppSymbol, icons } from "@/components/Symbol";
import { colors } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";

// Custom bottom tabs, Android-targeted (expo-router native tabs deferred
// while alpha — same hand-rolled rule as RoomSheet/Switch). Material-3
// indicator pill, ink duet, Inter labels. Mounted once by the (tabs)
// layout, so room/create/join (root stack) stay chrome-clean.
const TABS = [
  { key: "index", label: "Home", href: "/", testID: "tab-home", icon: icons.home },
  { key: "trips", label: "Trips", href: "/trips", testID: "tab-trips", icon: icons.trips },
  { key: "profile", label: "Profile", href: "/profile", testID: "tab-profile", icon: icons.profile },
] as const;

export function TabBar() {
  const router = useRouter();
  const segments = useSegments();
  // Segments include the group: (tabs)/index -> ["(tabs)"], (tabs)/trips
  // -> ["(tabs)", "trips"]. Bare index contributes no segment. Matched by
  // value on the joined path: positional indexing breaks under one of the
  // two type regimes (generated tuple union locally vs 1-tuple fallback in
  // CI, where Metro never generates router.d.ts).
  const path = segments.join("/");
  const active = path.endsWith("trips") ? "trips" : path.endsWith("profile") ? "profile" : "index";

  return (
    // SafeArea bottom keeps every tab fully above the system nav bar — the
    // lower strip of an edge-to-edge bar is untappable (system consumes it).
    <SafeAreaView style={styles.bar} edges={["bottom"]}>
      {TABS.map((tab) => {
        const selected = active === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            testID={tab.testID}
            hitSlop={4}
            onPress={() => {
              if (!selected) router.replace(tab.href);
            }}
          >
            <View style={[styles.pill, selected && styles.pillSelected]}>
              <AppSymbol
                name={{ ios: tab.icon.ios, android: tab.icon.android }}
                fallback={tab.icon.fallback}
                size={22}
                tintColor={selected ? colors.text : colors.textDim}
              />
            </View>
            <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  pillSelected: { backgroundColor: colors.surfaceAlt },
  label: { color: colors.textDim, fontSize: 12, fontFamily: fontFamily.medium },
  labelSelected: { color: colors.text, fontFamily: fontFamily.semiBold },
});
