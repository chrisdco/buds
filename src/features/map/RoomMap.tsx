import { Camera, Map, type CameraRef, type LngLat } from "@maplibre/maplibre-react-native";
import type { ReactNode, RefObject } from "react";
import { StyleSheet } from "react-native";

// OpenFreeMap: free vector tiles, no API key, production use allowed.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

interface RoomMapProps {
  cameraRef?: RefObject<CameraRef | null>;
  onLongPress?: (lngLat: LngLat) => void;
  onUserPan?: () => void;
  children?: ReactNode;
}

export function RoomMap({ cameraRef, onLongPress, onUserPan, children }: RoomMapProps) {
  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={MAP_STYLE_URL}
      attributionPosition={{ bottom: 8, left: 8 }}
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
