import {
  Camera,
  Map,
  type CameraRef,
  type LngLat,
} from "@maplibre/maplibre-react-native";
import type { ReactNode, RefObject } from "react";
import { StyleSheet } from "react-native";

// Mirrors MapLibre's OrnamentViewPosition (not exported from the package
// root): exactly one of top/bottom and one of left/right.
export type OrnamentPosition =
  | { top: number; left: number }
  | { top: number; right: number }
  | { bottom: number; right: number }
  | { bottom: number; left: number };

// OpenFreeMap dark: free vector tiles, no API key, production use allowed.
// Dark basemap matches the app's night UI (Uber-style) and keeps map chrome
// legible; markers/routes carry the color.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

interface RoomMapProps {
  cameraRef?: RefObject<CameraRef | null>;
  onLongPress?: (lngLat: LngLat) => void;
  onUserPan?: () => void;
  /** Keeps logo/attribution visible above the bottom sheet. */
  ornamentPosition?: OrnamentPosition;
  children?: ReactNode;
}

export function RoomMap({
  cameraRef,
  onLongPress,
  onUserPan,
  ornamentPosition = { bottom: 8, left: 8 },
  children,
}: RoomMapProps) {
  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={MAP_STYLE_URL}
      attributionPosition={ornamentPosition}
      logoPosition={ornamentPosition}
      onLongPress={(event) => onLongPress?.(event.nativeEvent.lngLat)}
      onRegionDidChange={(event) => {
        if (event.nativeEvent.userInteraction) onUserPan?.();
      }}
    >
      <Camera ref={cameraRef} initialViewState={{ zoom: 1.2 }} maxZoom={19} />
      {children}
    </Map>
  );
}
