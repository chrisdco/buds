import {
  Camera,
  Map,
  type CameraRef,
  type LngLat,
  type MapRef,
} from "@maplibre/maplibre-react-native";
import type { ReactNode, RefObject } from "react";
import { StyleSheet } from "react-native";

import { basemapStyle, type MapScheme } from "@/services/map/basemap";
import { useScheme } from "@/theme";

// Mirrors MapLibre's OrnamentViewPosition (not exported from the package
// root): exactly one of top/bottom and one of left/right.
export type OrnamentPosition =
  | { top: number; left: number }
  | { top: number; right: number }
  | { bottom: number; right: number }
  | { bottom: number; left: number };

// OpenFreeMap vector tiles (free, no API key, production use allowed)
// painted by our own basemap (services/map/basemap.ts): bundled with the
// app, so the first frame is already the final style, no fetch or cache.

interface RoomMapProps {
  cameraRef?: RefObject<CameraRef | null>;
  /** Exposes getCenter() for adjust-pin mode (pin stays screen-centered). */
  mapRef?: RefObject<MapRef | null>;
  onLongPress?: (lngLat: LngLat) => void;
  onUserPan?: () => void;
  /** Fires on every region change (user or programmatic). */
  onRegionChange?: () => void;
  /** Keeps the attribution visible above the bottom sheet. */
  ornamentPosition?: OrnamentPosition;
  /** Basemap palette; defaults to the app theme. */
  scheme?: MapScheme;
  children?: ReactNode;
}

export function RoomMap({
  cameraRef,
  mapRef,
  onLongPress,
  onUserPan,
  onRegionChange,
  ornamentPosition = { bottom: 8, right: 8 },
  scheme,
  children,
}: RoomMapProps) {
  const appScheme = useScheme();
  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={basemapStyle(scheme ?? appScheme)}
      ref={mapRef}
      // No MapLibre badge: the required tile attribution (OpenMapTiles/OSM)
      // stays as the tappable (i) button, bottom-right out of the map's way.
      logo={false}
      attributionPosition={ornamentPosition}
      onLongPress={(event) => onLongPress?.(event.nativeEvent.lngLat)}
      onRegionDidChange={(event) => {
        if (event.nativeEvent.userInteraction) onUserPan?.();
        onRegionChange?.();
      }}
    >
      <Camera ref={cameraRef} initialViewState={{ zoom: 1.2 }} maxZoom={19} />
      {children}
    </Map>
  );
}
