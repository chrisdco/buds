import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Side-effect import: registers the headless background-location task at module
// scope so the OS can run it when the app is backgrounded (required placement).
import "@/services/location/backgroundTask";

import { colors } from "@/constants/theme";
import { setupNotifications } from "@/services/notifications";
import { useSessionStore } from "@/stores/sessionStore";

export default function RootLayout() {
  const ready = useSessionStore((s) => s.ready);

  useEffect(() => {
    void useSessionStore.getState().init();
    void setupNotifications();
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
