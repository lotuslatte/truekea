import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };
export type LocationResult = {
  coords: Coords;
  /** True when the coordinates are a default and not the device position. */
  isFallback: boolean;
  /** True when the system dialog can still be shown (never asked, or may ask again). */
  canAsk: boolean;
};

// Plaza de Armas de Lima: fallback when there is no location access.
export const LIMA_CENTER: Coords = { lat: -12.0464, lng: -77.0428 };

/**
 * Device position, or a fallback. With `request: false` (the default) the
 * system permission dialog is never shown: the screen explains first why the
 * location helps and calls again with `request: true` when the person agrees.
 */
export async function getCurrentCoords(
  opts: { request?: boolean; fallback?: Coords | null } = {},
): Promise<LocationResult> {
  const fallback = opts.fallback ?? LIMA_CENTER;
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted' && opts.request) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== 'granted') {
      return { coords: fallback, isFallback: true, canAsk: permission.canAskAgain !== false };
    }
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return {
      coords: { lat: position.coords.latitude, lng: position.coords.longitude },
      isFallback: false,
      canAsk: false,
    };
  } catch {
    return { coords: fallback, isFallback: true, canAsk: false };
  }
}
