import { Tabs } from "expo-router/tabs";

import { TabBar } from "@/features/nav/TabBar";
import { useColors } from "@/theme";

// First-level IA shell: Home / Trips / Profile on expo-router's stable JS
// Tabs (each root keeps its scroll + state across switches) drawn by our
// floating TabBar. Room, create, and join live outside this group on the
// root stack, so the active-trip screen keeps full-bleed chrome.
export default function TabsLayout() {
  const colors = useColors();
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
