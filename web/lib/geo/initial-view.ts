export interface GeoPoint {
  lat: number;
  lon: number;
}

const DEFAULT_CENTER: [number, number] = [110, -2]; // sekitar Indonesia

/**
 * Hitung titik tengah & tingkat zoom awal yang membingkai semua titik
 * sekaligus, supaya peta gak selalu mulai dari Indonesia kalau lot aktifnya
 * tersebar di beberapa negara. Heuristik kasar berbasis rentang sudut
 * (bukan perhitungan proyeksi presisi) -- cukup buat "gak ada yang kepotong
 * saat pertama dibuka", bukan pas piksel; pengguna tetap bisa pan/zoom
 * manual dari titik awal ini.
 */
export function computeInitialView(
  points: readonly GeoPoint[],
): { center: [number, number]; zoom: number } {
  if (points.length === 0) {
    return { center: DEFAULT_CENTER, zoom: 1 };
  }

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const span = Math.max(
    Math.max(...lats) - Math.min(...lats),
    Math.max(...lons) - Math.min(...lons),
  );

  let zoom: number;
  if (span > 100) zoom = 1;
  else if (span > 40) zoom = 1.5;
  else if (span > 15) zoom = 2.5;
  else if (span > 5) zoom = 4;
  else zoom = 6;

  return { center: [centerLon, centerLat], zoom };
}
