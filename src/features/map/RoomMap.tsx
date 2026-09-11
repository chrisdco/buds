import {
  Camera,
  Map,
  type CameraRef,
  type LngLat,
  type MapRef,
} from "@maplibre/maplibre-react-native";
import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { StyleSheet } from "react-native";

import { CALM_SOURCE_URL, loadCalmStyle } from "@/services/map/calmStyle";

// Mirrors MapLibre's OrnamentViewPosition (not exported from the package
// root): exactly one of top/bottom and one of left/right.
export type OrnamentPosition =
  | { top: number; left: number }
  | { top: number; right: number }
  | { bottom: number; right: number }
  | { bottom: number; left: number };

// OpenFreeMap dark: free vector tiles, no API key, production use allowed.
// Dark basemap matches the app's night UI (Uber-style) and keeps map chrome
// legible; markers/routes carry the color. Rendered through the calm pass
// (muted minor roads, deferred far labels) — raw URL is the fallback.

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
  children?: ReactNode;
}

export function RoomMap({
  cameraRef,
  mapRef,
  onLongPress,
  onUserPan,
  onRegionChange,
  ornamentPosition = { bottom: 8, right: 8 },
  children,
}: RoomMapProps) {
  // Calmed style object once ready; the raw URL paints first so the map
  // never waits on the fetch-then-cache round trip.
  const [mapStyle, setMapStyle] = useState<string | StyleSpecification>(CALM_SOURCE_URL);
  useEffect(() => {
    let live = true;
    void loadCalmStyle().then((s) => {
      if (live) setMapStyle(s);
    });
    return () => {
      live = false;
    };
  }, []);
  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={mapStyle}
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
