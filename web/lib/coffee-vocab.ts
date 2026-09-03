/**
 * Kosakata kopi Indonesia untuk saran isian di form tambah lot.
 *
 * Ini daftar kurasi, bukan hasil scraping, dan itu disengaja: domainnya kecil
 * dan stabil, jadi ia ditulis sekali alih-alih dirawat sebagai pipeline.
 * Digabung saat runtime dengan nilai yang benar-benar pernah dipakai
 * (`distinctLotValues`), jadi daftar ini cuma titik awal, bukan batas.
 *
 * Kolomnya tetap teks bebas: daftar ini menawarkan, tidak memaksa.
 */

export const VARIETALS: readonly string[] = [
  "Typica",
  "Bourbon",
  "Catimor",
  "Ateng",
  "Sigararutang",
  "Gayo 1",
  "Gayo 2",
  "Lini S",
  "S795",
  "P88",
  "Andungsari",
  "Kartika",
  "Komasti",
  "Mix Var",
] as const;

export const PROCESS_METHODS: readonly string[] = [
  "Natural",
  "Washed",
  "Honey",
  "Anaerobic",
  "Natural Anaerobic",
  "Washed Anaerobic",
  "Giling Basah",
  "Semi-washed",
] as const;
