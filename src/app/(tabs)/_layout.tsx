import { Slot } from "expo-router";
import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";
import { TabBar } from "@/features/nav/TabBar";

// First-level IA shell: Home / Trips / Profile share one custom tab bar.
// Room, create, and join live outside this group on the root stack, so the
// active-trip screen keeps full-bleed chrome (no tabs over the map).
export default function TabsLayout() {
  return (
    <View style={styles.shell}>
      <View style={styles.content}>
        <Slot />
      </View>
      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
});
