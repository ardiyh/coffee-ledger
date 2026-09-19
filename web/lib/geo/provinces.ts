export interface WorldCountry {
  name: string;
  lat: number;
  lon: number;
}

/**
 * Titik pusat 38 provinsi Indonesia, buat perkiraan lokasi di peta lot aktif
 * ketika origin sebuah lot menyebut nama provinsinya. Perkiraan kasar (bukan
 * sentroid geografis yang diukur presisi) -- cukup buat "kira-kira di mana",
 * konsisten dengan keputusan bahwa peta ini gak butuh presisi (lihat spec
 * docs/superpowers/specs/2026-09-19-origin-map-world-design.md §1).
 *
 * Terpisah dari `COFFEE_REGIONS` di web/lib/regions.ts: daftar itu tetap
 * dipakai apa adanya buat saran isian form tambah lot (nama daerah kopi
 * spesifik, bukan provinsi) -- dua kebutuhan yang beda, sengaja gak
 * disatukan.
 */
export const INDONESIA_PROVINCES: readonly WorldCountry[] = [
  { name: "Aceh", lat: 4.5, lon: 96.5 },
  { name: "Sumatera Utara", lat: 2.5, lon: 99.0 },
  { name: "Sumatera Barat", lat: -0.9, lon: 100.4 },
  { name: "Riau", lat: 0.5, lon: 101.9 },
  { name: "Jambi", lat: -1.6, lon: 103.6 },
  { name: "Sumatera Selatan", lat: -3.3, lon: 104.0 },
  { name: "Bengkulu", lat: -3.6, lon: 102.3 },
  { name: "Lampung", lat: -4.9, lon: 105.2 },
  { name: "Kepulauan Bangka Belitung", lat: -2.7, lon: 106.4 },
  { name: "Kepulauan Riau", lat: 3.9, lon: 108.1 },
  { name: "DKI Jakarta", lat: -6.2, lon: 106.8 },
  { name: "Jawa Barat", lat: -6.9, lon: 107.6 },
  { name: "Jawa Tengah", lat: -7.2, lon: 110.1 },
  { name: "DI Yogyakarta", lat: -7.8, lon: 110.4 },
  { name: "Jawa Timur", lat: -7.5, lon: 112.2 },
  { name: "Banten", lat: -6.4, lon: 106.1 },
  { name: "Bali", lat: -8.4, lon: 115.2 },
  { name: "Nusa Tenggara Barat", lat: -8.7, lon: 117.4 },
  { name: "Nusa Tenggara Timur", lat: -8.7, lon: 121.1 },
  { name: "Kalimantan Barat", lat: -0.3, lon: 111.5 },
  { name: "Kalimantan Tengah", lat: -1.7, lon: 113.4 },
  { name: "Kalimantan Selatan", lat: -3.1, lon: 115.3 },
  { name: "Kalimantan Timur", lat: 0.5, lon: 116.5 },
  { name: "Kalimantan Utara", lat: 3.1, lon: 116.8 },
  { name: "Sulawesi Utara", lat: 1.2, lon: 124.8 },
  { name: "Sulawesi Tengah", lat: -1.4, lon: 121.4 },
  { name: "Sulawesi Selatan", lat: -3.7, lon: 119.9 },
  { name: "Sulawesi Tenggara", lat: -4.1, lon: 122.2 },
  { name: "Gorontalo", lat: 0.7, lon: 122.4 },
  { name: "Sulawesi Barat", lat: -2.7, lon: 119.2 },
  { name: "Maluku", lat: -3.5, lon: 128.9 },
  { name: "Maluku Utara", lat: 1.5, lon: 127.8 },
  { name: "Papua Barat", lat: -1.3, lon: 133.2 },
  { name: "Papua Barat Daya", lat: -0.9, lon: 132.0 },
  { name: "Papua", lat: -4.5, lon: 138.5 },
  { name: "Papua Tengah", lat: -3.9, lon: 136.9 },
  { name: "Papua Pegunungan", lat: -4.1, lon: 138.9 },
  { name: "Papua Selatan", lat: -7.0, lon: 139.9 },
] as const;
