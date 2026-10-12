import type { Coords } from '@/lib/location';

export type District = { name: string; centroid: Coords };

// Lima Metropolitana + Callao. Centroids are approximate on purpose: profile and
// item locations are stored at district granularity, never exact addresses.
export const LIMA_DISTRICTS: District[] = [
  { name: 'Ate', centroid: { lat: -12.0261, lng: -76.9183 } },
  { name: 'Barranco', centroid: { lat: -12.1494, lng: -77.0208 } },
  { name: 'Breña', centroid: { lat: -12.0561, lng: -77.0508 } },
  { name: 'Callao', centroid: { lat: -12.0522, lng: -77.1283 } },
  { name: 'Carabayllo', centroid: { lat: -11.9017, lng: -77.0336 } },
  { name: 'Cercado de Lima', centroid: { lat: -12.0464, lng: -77.0428 } },
  { name: 'Chorrillos', centroid: { lat: -12.1789, lng: -77.0122 } },
  { name: 'Comas', centroid: { lat: -11.9483, lng: -77.0619 } },
  { name: 'El Agustino', centroid: { lat: -12.0433, lng: -77.0011 } },
  { name: 'Independencia', centroid: { lat: -11.9917, lng: -77.0533 } },
  { name: 'Jesús María', centroid: { lat: -12.0731, lng: -77.0478 } },
  { name: 'La Molina', centroid: { lat: -12.0794, lng: -76.9394 } },
  { name: 'La Victoria', centroid: { lat: -12.0653, lng: -77.0217 } },
  { name: 'Lince', centroid: { lat: -12.0836, lng: -77.0369 } },
  { name: 'Los Olivos', centroid: { lat: -11.9711, lng: -77.0733 } },
  { name: 'Lurigancho-Chosica', centroid: { lat: -11.9425, lng: -76.7061 } },
  { name: 'Lurín', centroid: { lat: -12.2758, lng: -76.8683 } },
  { name: 'Magdalena del Mar', centroid: { lat: -12.0906, lng: -77.0742 } },
  { name: 'Miraflores', centroid: { lat: -12.1211, lng: -77.0297 } },
  { name: 'Pachacámac', centroid: { lat: -12.2264, lng: -76.8594 } },
  { name: 'Pueblo Libre', centroid: { lat: -12.0742, lng: -77.0628 } },
  { name: 'Puente Piedra', centroid: { lat: -11.8628, lng: -77.0742 } },
  { name: 'Rímac', centroid: { lat: -12.0292, lng: -77.0428 } },
  { name: 'San Borja', centroid: { lat: -12.1072, lng: -76.9992 } },
  { name: 'San Isidro', centroid: { lat: -12.0975, lng: -77.0364 } },
  { name: 'San Juan de Lurigancho', centroid: { lat: -11.9772, lng: -77.0083 } },
  { name: 'San Juan de Miraflores', centroid: { lat: -12.1550, lng: -76.9700 } },
  { name: 'San Luis', centroid: { lat: -12.0742, lng: -76.9958 } },
  { name: 'San Martín de Porres', centroid: { lat: -12.0072, lng: -77.0942 } },
  { name: 'San Miguel', centroid: { lat: -12.0778, lng: -77.0906 } },
  { name: 'Santa Anita', centroid: { lat: -12.0431, lng: -76.9719 } },
  { name: 'Santiago de Surco', centroid: { lat: -12.1356, lng: -76.9928 } },
  { name: 'Surquillo', centroid: { lat: -12.1150, lng: -77.0117 } },
  { name: 'Villa El Salvador', centroid: { lat: -12.2136, lng: -76.9369 } },
  { name: 'Villa María del Triunfo', centroid: { lat: -12.1608, lng: -76.9536 } },
];

export function districtCentroid(name: string): Coords | null {
  return LIMA_DISTRICTS.find((d) => d.name === name)?.centroid ?? null;
}

// PostGIS geography input: WKT keeps the insert simple from the client.
export function toWkt(coords: Coords): string {
  return `POINT(${coords.lng} ${coords.lat})`;
}
