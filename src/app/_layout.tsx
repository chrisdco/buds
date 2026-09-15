import { useFonts } from "expo-font";
import { DarkTheme, ThemeProvider } from "expo-router";
import Stack from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Side-effect import: registers the headless background-location task at module
// scope so the OS can run it when the app is backgrounded (required placement).
import "@/services/location/backgroundTask";

import { appFonts } from "@/constants/fonts";
import { colors } from "@/constants/theme";
import { LoadingView } from "@/components/ui";
import { ConfirmSheet } from "@/features/room/ConfirmSheet";
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
        <LoadingView />
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.loading}>
        <LoadingView />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        {/* Dark navigation theme (expo-router skill): pins native surfaces
        to dark so future native chrome (tabs glass, sheets) matches our ink
        UI instead of flashing white. Visual no-op today — all headers hidden. */}
        <ThemeProvider value={DarkTheme}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
          {/* Native confirm dialogs shared by every screen: location priming on
          home, identity/wipe in settings, leave/end/kick in rooms. Must live
          here — requestConfirm() callers outside the room layout (home,
          settings) would otherwise await a sheet that never renders. */}
          <ConfirmSheet />
        </ThemeProvider>
      </SafeAreaProvider>
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
