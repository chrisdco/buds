import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { useRouter, DarkTheme, ThemeProvider } from "expo-router";
import Stack from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { Asset } from "expo-asset";
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
import { destCreateParams } from "@/lib/tripPresets";
import { getPlannedTrips } from "@/lib/planned";
import { setupNotifications } from "@/services/notifications";
import { useRecentsStore } from "@/stores/recentsStore";
import { usePlacesStore } from "@/stores/placesStore";
import { usePlannedStore } from "@/stores/plannedStore";
import { useSessionStore } from "@/stores/sessionStore";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const ready = useSessionStore((s) => s.ready);
  const router = useRouter();
  const [fontsLoaded] = useFonts(appFonts);

  useEffect(() => {
    void useSessionStore.getState().init();
    void setupNotifications();
    // Resident recents: load once so tab screens paint rows on first commit
    // instead of empty-then-populated on every focus.
    void useRecentsStore.getState().refresh();
    void usePlacesStore.getState().refresh();
    void usePlannedStore.getState().refresh();
    // Decode every bundled illustration bitmap now (fire-and-forget, off the
    // splash path): by the time any tab mounts its art, the pixels are
    // cached and each screen paints complete in a single commit — no
    // placeholder-then-pop like deferred mounting would cause.
    void Asset.loadAsync([
      require("../../assets/illustrations/destination.png"),
      require("../../assets/illustrations/order-ride.png"),
      require("../../assets/illustrations/travel-together.png"),
      require("../../assets/illustrations/share-location.png"),
      require("../../assets/illustrations/location-search.png"),
    ]).catch(() => {});
  }, []);

  // Hold the splash until fonts AND session are ready: first paint must
  // already be Inter, never a system-font flash. hideAsync is fire-and-log:
  // a rejected hide must never wedge the app on the splash, and a watchdog
  // guarantees the overlay lifts even if a readiness gate stalls.
  useEffect(() => {
    if (fontsLoaded && ready) {
      SplashScreen.hideAsync().catch((e) => {
        console.warn("splash hide failed", e);
      });
    }
  }, [fontsLoaded, ready]);

  useEffect(() => {
    const watchdog = setTimeout(() => {
      SplashScreen.hideAsync().catch((e) => {
        console.warn("splash watchdog hide failed", e);
      });
    }, 10000);
    return () => clearTimeout(watchdog);
  }, []);

  // Planned-trip reminder taps ("Later"): cold or warm, they land on
  // create with the destination prefilled — the room flow takes it over.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const plannedId = response.notification.request.content.data?.plannedId;
      if (typeof plannedId !== "string") return;
      void (async () => {
        const trips = await getPlannedTrips();
        const trip = trips.find((t) => t.id === plannedId);
        if (!trip) return;
        router.push({
          pathname: "/create",
          params: {
            mode: "converge",
            limit: "10",
            duration: "12",
            name: trip.place.name.slice(0, 60),
            ...destCreateParams({
              lat: trip.place.lat,
              lng: trip.place.lng,
              label: trip.place.name,
            }),
          },
        });
      })();
    });
    return () => sub.remove();
  }, [router]);

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
