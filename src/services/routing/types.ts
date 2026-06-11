export interface LatLng {
  lat: number;
  lng: number;
}

export type RouteFetcher = (
  from: LatLng,
  to: LatLng,
  signal: AbortSignal,
) => Promise<{
  coords: [number, number][]; // GeoJSON lnglat order
  distanceM: number;
  durationS: number;
}>;
