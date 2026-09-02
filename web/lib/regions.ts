/**
 * Region kopi Indonesia yang dikenal, dengan koordinatnya.
 *
 * Dipakai dua tempat: `<datalist>` di form tambah lot (mempercepat input dan
 * mendorong penulisan origin yang konsisten), dan peta lot aktif di dashboard.
 *
 * Kolom `origin` tetap teks bebas — daftar ini menawarkan, tidak memaksa.
 * Lot dengan origin di luar daftar cukup tidak muncul di peta.
 */
export interface CoffeeRegion {
  /** Persis seperti yang masuk ke kolom `origin`. */
  name: string;
  lat: number;
  lon: number;
}

export const COFFEE_REGIONS: readonly CoffeeRegion[] = [
  { name: "Gayo, Aceh", lat: 4.63, lon: 96.85 },
  { name: "Mandailing, Sumatera Utara", lat: 0.79, lon: 99.26 },
  { name: "Lintong, Sumatera Utara", lat: 2.36, lon: 98.93 },
  { name: "Kerinci, Jambi", lat: -1.7, lon: 101.27 },
  { name: "Semendo, Sumatera Selatan", lat: -4.13, lon: 103.6 },
  { name: "Preanger, Jawa Barat", lat: -7.13, lon: 107.62 },
  { name: "Temanggung, Jawa Tengah", lat: -7.32, lon: 110.17 },
  { name: "Ijen, Jawa Timur", lat: -8.06, lon: 114.24 },
  { name: "Kintamani, Bali", lat: -8.25, lon: 115.35 },
  { name: "Bajawa, Flores", lat: -8.79, lon: 120.99 },
  { name: "Toraja, Sulawesi Selatan", lat: -2.97, lon: 119.86 },
  { name: "Rantekarua, Sulawesi Selatan", lat: -2.9, lon: 119.9 },
  { name: "Wamena, Papua Pegunungan", lat: -4.1, lon: 138.95 },
] as const;
