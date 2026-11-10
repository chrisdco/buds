import { Linking, Platform } from "react-native";

// Secondary handoff: in-app guidance (features/guidance) is what every
// "Navigate" starts; this opens Google/Apple Maps for voice guidance, from
// the guidance banner's "Maps" button.
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
