import { useRouter, useSegments } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppSymbol, icons } from "@/components/Symbol";
import { colors, radius } from "@/constants/theme";
import { fontFamily } from "@/constants/fonts";

// Custom bottom tabs, Android-targeted (expo-router native tabs deferred
// while alpha — same hand-rolled rule as RoomSheet/Switch). Uber-style
// floating pill: only the container itself is chrome (solid surface,
// elevation); the margins around it stay transparent so the screen behind
// shows through. Mounted once by the (tabs) layout, so room/create/join
// (root stack) stay chrome-clean.
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
    // Outer stays transparent (gaps show the screen behind); SafeArea bottom
    // keeps the pill fully above the system nav bar — the lower strip of an
    // edge-to-edge bar is untappable (system consumes it).
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const selected = active === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityHint={selected ? `${tab.label}, current tab` : `Go to ${tab.label}`}
              accessibilityState={{ selected }}
              testID={tab.testID}
              hitSlop={4}
              onPress={() => {
                if (!selected) router.replace(tab.href);
              }}
            >
            <View style={styles.pill}>
              {/* Selected fill mounts/unmounts with its final paint instead of
              mutating backgroundColor on the pill: on Fabric/Android a bg-only
              update can drop the view's borderRadius, turning the capsule
              into a box after navigating away and back. */}
              {selected ? <View style={styles.pillFill} pointerEvents="none" /> : null}
              <AppSymbol
                name={{ ios: tab.icon.ios, android: tab.icon.android }}
                fallback={tab.icon.fallback}
                size={26}
                tintColor={selected ? colors.text : colors.textDim}
              />
              <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
            </View>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "transparent" },
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 30,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    // Elevated above content like Uber's floating bar (Android shadow).
    // elevation is the whole shadow on Android: the legacy shadow* props
    // are iOS-only no-ops here, so they stay out (native-ui skill).
    elevation: 8,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 58 },
  tabPressed: { opacity: 0.7 },
  pill: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 26,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: "transparent",
  },
  pillFill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.raised,
    borderRadius: radius.full,
  },
  label: { color: colors.textDim, fontSize: 13, fontFamily: fontFamily.medium },
  labelSelected: { color: colors.text, fontFamily: fontFamily.semiBold },
});
