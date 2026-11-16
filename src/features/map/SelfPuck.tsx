import { NativeUserLocation } from "@maplibre/maplibre-react-native";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { hasLocationPermission } from "@/services/location/permissions";

/**
 * True while foreground location is allowed. Re-checked whenever the app
 * comes back, so granting it in system Settings shows the puck at once.
 */
export function useLocationGranted(): boolean {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () =>
      void hasLocationPermission("foreground").then((g) => {
        if (alive) setGranted(g);
      });
    check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return granted;
}

/**
 * "You" on the map, Google Maps style: MapLibre's native puck (blue dot,
 * accuracy ring, direction cone). It reads the phone's GPS and compass
 * directly and animates between fixes on the native side, so it glides
 * instead of hopping with our 2 s location ticks and costs no JS renders.
 * Compass cone normally; travel direction while navigating, where the
 * compass is unreliable in a moving vehicle.
 */
export function SelfPuck({ navigating }: { navigating: boolean }) {
  return <NativeUserLocation mode={navigating ? "course" : "heading"} />;
}
