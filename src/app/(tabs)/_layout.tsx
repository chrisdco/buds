import { Tabs } from "expo-router/tabs";

import { colors } from "@/constants/theme";
import { TabBar } from "@/features/nav/TabBar";

// First-level IA shell: Home / Trips / Profile on expo-router's stable JS
// Tabs (each root keeps its scroll + state across switches) drawn by our
// floating TabBar. Room, create, and join live outside this group on the
// root stack, so the active-trip screen keeps full-bleed chrome.
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: "fade",
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="trips" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
