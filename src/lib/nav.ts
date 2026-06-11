import { Linking, Platform } from "react-native";

// Turn-by-turn is deliberately handed off to the OS navigation app — the
// shared live map is Buds' job; voice guidance is Google/Apple's.
export async function openExternalNavigation(lat: number, lng: number): Promise<void> {
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const nativeUrl =
    Platform.OS === "android"
      ? `google.navigation:q=${lat},${lng}`
      : `maps://app?daddr=${lat},${lng}`;
  try {
    await Linking.openURL(nativeUrl);
  } catch {
    await Linking.openURL(webUrl);
  }
}
