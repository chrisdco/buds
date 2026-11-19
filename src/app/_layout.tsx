import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { useRouter, DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from "expo-router";
import Stack from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { Asset } from "expo-asset";
import { ObserveInteractiveMarker, ObserveRoot } from "expo-observe";
import type { ErrorBoundaryProps } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Side-effect import: registers the headless background-location task at module
// scope so the OS can run it when the app is backgrounded (required placement).
import "@/services/location/backgroundTask";

import { appFonts } from "@/constants/fonts";

import { LoadingView } from "@/components/ui";
import { ConfirmSheet } from "@/features/room/ConfirmSheet";
import { loadAppConfig } from "@/lib/appConfig";
import { initMonitoring, reportError, withMonitoring } from "@/lib/monitoring";
import { supabaseConfigured } from "@/lib/supabaseClient";
import { destCreateParams } from "@/lib/tripPresets";
import { getPlannedTrips } from "@/lib/planned";
import { setupNotifications } from "@/services/notifications";
import { useRecentsStore } from "@/stores/recentsStore";
import { usePlacesStore } from "@/stores/placesStore";
import { usePlannedStore } from "@/stores/plannedStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useThemeStore } from "@/stores/themeStore";
import { ThemeProvider, makeStyles, useColors, useScheme } from "@/theme";

initMonitoring();
void SplashScreen.preventAutoHideAsync();

function RootLayout() {
  return <ThemeProvider>{supabaseConfigured ? <AppRoot /> : <MissingConfig />}</ThemeProvider>;
}

export default withMonitoring(ObserveRoot.wrap(RootLayout));

/**
 * Last-resort screen for a render crash anywhere in the app (expo-router
 * renders this in place of the layout). The error goes to Sentry; the user
 * gets a way back instead of a white screen.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const styles = useStyles();
  useEffect(() => {
    reportError(error, { where: "root-boundary" });
    SplashScreen.hideAsync().catch(() => {});
  }, [error]);
  return (
    <View style={styles.loading}>
      <Text style={styles.configTitle}>Something went wrong</Text>
      <Text style={styles.configBody}>Buds hit an unexpected problem. Try again, or restart the app if it keeps happening.</Text>
      <Pressable accessibilityRole="button" onPress={() => void retry()} style={styles.retry}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

/**
 * Build without backend config: say so on screen instead of crashing.
 * Nothing else mounts (session init would only fail against a placeholder).
 */
function MissingConfig() {
  const styles = useStyles();
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <View style={styles.loading}>
      <StatusBar style={useScheme() === "dark" ? "light" : "dark"} />
      <Text style={styles.configTitle}>This build isn&apos;t configured</Text>
      <Text style={styles.configBody}>
        It was built without the Supabase URL and key. Set EXPO_PUBLIC_SUPABASE_URL and
        EXPO_PUBLIC_SUPABASE_ANON_KEY for this build profile, then rebuild.
      </Text>
    </View>
  );
}

function AppRoot() {
  const styles = useStyles();
  const colors = useColors();
  const scheme = useScheme();
  const sessionReady = useSessionStore((s) => s.ready);
  const themeReady = useThemeStore((s) => s.ready);
  const ready = sessionReady && themeReady;
  const router = useRouter();
  const [fontsLoaded] = useFonts(appFonts);

  useEffect(() => {
    void useSessionStore.getState().init();
    void useThemeStore.getState().hydrate();
    void loadAppConfig();
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
      require("../../assets/illustrations/destination-light.png"),
      require("../../assets/illustrations/order-ride-light.png"),
      require("../../assets/illustrations/travel-together-light.png"),
      require("../../assets/illustrations/share-location-light.png"),
      require("../../assets/illustrations/location-search-light.png"),
    ]).catch(() => {});
  }, []);

  // Root window color follows the theme, so keyboard and sheet transitions
  // never flash the other scheme behind the React tree.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  // Navigation theme pins native surfaces (headers, modal backdrops) to
  // the app scheme; the card background is our canvas.
  const navTheme = useMemo(() => {
    const base = scheme === "dark" ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: colors.bg, card: colors.bg, text: colors.text } };
  }, [scheme, colors]);

  // Hold the splash until fonts, theme and session are ready: first paint must
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
  // Gated on readiness: the Stack (and so the router) only mounts once
  // fonts + session are ready, and pushing before that is dropped. The
  // live listener misses the tap that cold-launched the app, so the last
  // response is replayed once; the identifier ref dedupes the two paths.
  const handledResponse = useRef<string | null>(null);
  const openPlannedFromResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const responseId = response.notification.request.identifier;
      if (handledResponse.current === responseId) return;
      handledResponse.current = responseId;
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
    },
    [router],
  );
  const appReady = ready && fontsLoaded;
  useEffect(() => {
    if (!appReady) return;
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      openPlannedFromResponse(last);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(openPlannedFromResponse);
    return () => sub.remove();
  }, [appReady, openPlannedFromResponse]);

  if (!appReady) {
    return (
      <View style={styles.loading}>
        <LoadingView />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <NavThemeProvider value={navTheme}>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
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
          {/* First interactive frame for Observe's startup TTI. */}
          <ObserveInteractiveMarker />
        </NavThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  configTitle: { color: colors.text, fontSize: 22, textAlign: "center", marginBottom: 12 },
  configBody: { color: colors.textDim, fontSize: 16, lineHeight: 22, textAlign: "center" },
  retry: {
    marginTop: 24,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { color: colors.bg, fontSize: 16, fontWeight: "600" },
}));
