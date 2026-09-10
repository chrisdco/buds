import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Side-effect import: registers the headless background-location task at module
// scope so the OS can run it when the app is backgrounded (required placement).
import "@/services/location/backgroundTask";

import { appFonts } from "@/constants/fonts";
import { colors } from "@/constants/theme";
import { setupNotifications } from "@/services/notifications";
import { useSessionStore } from "@/stores/sessionStore";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const ready = useSessionStore((s) => s.ready);
  const [fontsLoaded] = useFonts(appFonts);

  useEffect(() => {
    void useSessionStore.getState().init();
    void setupNotifications();
  }, []);

  // Hold the splash until fonts AND session are ready: first paint must
  // already be Inter, never a system-font flash.
  useEffect(() => {
    if (fontsLoaded && ready) void SplashScreen.hideAsync();
  }, [fontsLoaded, ready]);

  if (!ready || !fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

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
