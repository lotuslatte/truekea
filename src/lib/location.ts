import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

// Plaza de Armas de Lima: fallback when the user denies location access.
export const LIMA_CENTER: Coords = { lat: -12.0464, lng: -77.0428 };

export async function getCurrentCoords(): Promise<{ coords: Coords; isFallback: boolean }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { coords: LIMA_CENTER, isFallback: true };
    const position = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      coords: { lat: position.coords.latitude, lng: position.coords.longitude },
      isFallback: false,
    };
  } catch {
    return { coords: LIMA_CENTER, isFallback: true };
  }
}
