# Peta lot aktif jadi peta dunia interaktif

**Tanggal:** 2026-09-19
**Status:** Disetujui, siap masuk rencana implementasi

## 1. Konteks

Peta origin di dashboard (`web/app/(app)/_dashboard/origin-map.tsx`) cuma menggambar lot yang
`origin`-nya cocok **persis** (case-insensitive) dengan salah satu dari 13 daerah kopi
Indonesia yang di-hardcode di `web/lib/regions.ts` (`findRegion()`). Ini keputusan sadar dari
spec awal (`docs/superpowers/specs/2026-09-03-dashboard-lot-lifecycle-design.md` §6d): peta
itu "hiburan dan latihan geospasial, bukan alat", dan lot yang gak cocok "cukup tidak muncul
di peta, tanpa error" — ditulis waktu cuma ada 2-5 lot dan hampir semuanya dari Indonesia.

Dicek langsung ke data production (2026-09-19): dari 11 lot aktif, cuma **5 yang kegambar**
(4x "Gayo, Aceh", 1x "Toraja, Sulawesi Selatan"). Enam lainnya gak kegambar — tiga origin
Jawa Barat yang namanya lebih spesifik dari daftar ("Manglayang, Jawa Barat", "Mekarwangi,
Jawa Barat" x3), dan satu origin luar negeri ("EL Salvador"). Lebih dari separuh data asli
gak kegambar. Trade-off yang dulu wajar sekarang jadi kontraproduktif — dan pemilik app mau
nambah sourcing dari Ethiopia dan Colombia juga, jadi soal ini akan makin sering muncul, bukan
makin jarang.

Keputusan yang diambil bareng pemilik app lewat brainstorming:
1. Titik di peta **boleh perkiraan** (level provinsi buat Indonesia, level negara buat luar
   negeri) — gak perlu koordinat presisi per lot.
2. Origin luar negeri **harus ikut kegambar**, bukan cuma masuk daftar teks terpisah.
3. Peta harus jadi **peta dunia yang interaktif** — bisa di-pan dan di-zoom, bukan SVG statis
   Indonesia-saja seperti sekarang.

## 2. Lingkup

**Termasuk:**
- Ganti logic pencocokan origin: dua lapis (negara luar Indonesia dulu, baru provinsi
  Indonesia), keduanya berbasis keyword/substring, bukan exact-match.
- Ganti rendering peta dari SVG tangan jadi peta dunia interaktif (`react-simple-maps`),
  dengan pan/zoom bawaan.
- Tampilan awal peta otomatis nge-frame semua marker aktif sekaligus (bounding box), bukan
  selalu center ke Indonesia.
- Daftar pendamping teks (nama region + jumlah lot + total gram) dipertahankan, key-nya ganti
  ikut hasil pencocokan baru (provinsi/negara).

**Tidak termasuk:**
- Koordinat presisi per lot (geocoding beneran, atau input manual titik saat nambah lot).
- Kolom lat/lon baru di database — titik tetap dihitung saat render, dari nama provinsi/negara
  yang cocok, bukan disimpan.
- Perubahan ke form tambah lot atau kolom `origin` itu sendiri (tetap teks bebas seperti
  sekarang).

## 3. Dua daftar region yang terpisah — jangan disatukan

`web/lib/regions.ts` sekarang punya `COFFEE_REGIONS` (13 daerah kopi spesifik, mis. "Gayo,
Aceh") yang dipakai **bukan cuma** buat peta — dia juga jadi sumber `<datalist>` saran isian
kolom Origin di form tambah lot (`web/app/(app)/rak/page.tsx:25`, digabung dengan origin yang
pernah dipakai). Itu tetap berguna apa adanya: menyarankan nama daerah spesifik saat mengetik
itu beda kebutuhan dari mencocokkan teks bebas ke titik peta.

Karena itu **`COFFEE_REGIONS` tidak diubah atau digantikan.** Yang diganti cuma `findRegion()`
(satu-satunya pemakainya adalah peta) dengan pencocokan baru berbasis daftar yang sepenuhnya
terpisah:

- **Provinsi Indonesia** (daftar baru, file baru `web/lib/geo/provinces.ts`): 38 provinsi resmi
  Indonesia, masing-masing dengan titik koordinat pusat provinsi. Jauh lebih kasar dari
  `COFFEE_REGIONS`, tapi jaminannya lebih tinggi: origin manapun yang menyebut provinsi (dan
  hampir semua origin yang ditulis pemilik app menyebutnya, seperti "Jawa Barat" di dua contoh
  yang sekarang gak kegambar) otomatis kecocok.
- **Negara di luar Indonesia**: **tidak perlu daftar manual.** Diambil dari data topologi dunia
  yang sudah dibawa `react-simple-maps` (paket `world-atlas`, `countries-110m.json`) — tiap
  negara di situ punya nama (`properties.name`) dan bentuk geografis. Titik pusatnya dihitung
  otomatis dari bentuknya (`d3-geo`'s `geoCentroid()`), sekali saat modul dimuat, bukan
  di-hardcode. Efeknya: nambah sourcing dari negara baru manapun (Kenya, Brasil, dst) otomatis
  kebaca tanpa perlu update kode.

## 4. Fungsi pencocokan (pure function, dites langsung)

File baru `web/lib/geo/match-origin.ts`:

```ts
export interface MatchedPlace {
  kind: "country" | "province";
  name: string;
  lat: number;
  lon: number;
}

export interface WorldCountry {
  name: string;
  lat: number;
  lon: number;
}

/**
 * Cocokkan teks origin bebas ke satu titik perkiraan. Negara luar Indonesia
 * dicek lebih dulu (nama negara biasanya ditulis eksplisit, mis. "El
 * Salvador"), baru provinsi Indonesia (jarang ditulis kata "Indonesia"
 * sendiri). Nama terpanjang dicek lebih dulu di tiap lapis supaya "Jawa
 * Barat" tidak keduluan match sebagian oleh nama provinsi lain yang jadi
 * substring-nya (di Indonesia praktis tidak terjadi, tapi ini menutup
 * kemungkinan itu di negara mana pun).
 */
export function matchOrigin(
  origin: string,
  worldCountries: readonly WorldCountry[],
  provinces: readonly WorldCountry[],
): MatchedPlace | undefined {
  const needle = origin.toLowerCase();

  const country = [...worldCountries]
    .filter((c) => c.name.toLowerCase() !== "indonesia")
    .sort((a, b) => b.name.length - a.name.length)
    .find((c) => needle.includes(c.name.toLowerCase()));
  if (country) {
    return { kind: "country", name: country.name, lat: country.lat, lon: country.lon };
  }

  const province = [...provinces]
    .sort((a, b) => b.name.length - a.name.length)
    .find((p) => needle.includes(p.name.toLowerCase()));
  if (province) {
    return { kind: "province", name: province.name, lat: province.lat, lon: province.lon };
  }

  return undefined;
}
```

Daftar negara dunia (`worldCountries`) dan provinsi (`provinces`) sengaja jadi **parameter**,
bukan di-import langsung oleh `matchOrigin` — supaya fungsi ini bisa dites dengan daftar kecil
buatan tes, tanpa perlu menyeret `world-atlas`/`d3-geo`/`react-simple-maps` (paket berat,
khusus client) ke dalam test suite. Modul yang benar-benar menghitung `worldCountries` dari
`world-atlas` (file baru `web/lib/geo/world-countries.ts`, pakai `topojson-client` +
`d3-geo`'s `geoCentroid`) cuma dipakai oleh komponen peta itu sendiri.

## 5. Komponen peta jadi interaktif

`web/app/(app)/_dashboard/origin-map.tsx` ditulis ulang jadi `"use client"`, pakai
`react-simple-maps`:

- `<ComposableMap>` + `<ZoomableGroup>` — bungkus isi peta, kasih pan/zoom/scroll bawaan tanpa
  kode tambahan.
- `<Geographies>`/`<Geography>` — gambar outline semua negara dari `world-atlas`, di-style
  pakai token warna yang sama seperti sekarang (`--panel-2` isi daratan, `--line` garis batas,
  `--ground` buat laut/background).
- `<Marker>` per hasil `matchOrigin` yang match, dikelompokkan dan dijumlah stoknya persis
  seperti logic grouping yang sudah ada sekarang (satu marker per provinsi/negara, bukan per
  lot, ukurannya ikut akar-kuadrat stok relatif terhadap yang terbesar — logic ini dipindah
  apa adanya, cuma sumber datanya yang beda).
- Tampilan awal: hitung bounding box dari semua marker yang match, set posisi/zoom awal
  `<ZoomableGroup>` supaya semuanya kelihatan sekaligus tanpa perlu pan manual dulu. Kalau cuma
  ada satu marker (atau nol), fallback ke pusat Indonesia dengan zoom default yang wajar.

File lama `web/lib/geo/project.ts` (`indonesiaPath()`, `project()`, `MAP_SIZE` — proyeksi &
outline SVG Indonesia buatan tangan) **dihapus**. Tidak ada lagi pemakainya setelah
`react-simple-maps` mengurus proyeksi & outline sendiri; membiarkannya cuma jadi kode mati.

## 6. Daftar pendamping & lot yang gak kegambar

Daftar teks di bawah peta dipertahankan bentuknya (nama tempat, jumlah lot, total gram),
cuma dikelompokkan berdasarkan hasil `matchOrigin` yang baru (nama provinsi atau nama negara)
alih-alih nama daerah spesifik seperti sekarang.

Catatan "X lot gak kegambar: origin-nya gak ada di daftar region" tetap ada sebagai jaring
pengaman untuk origin yang beneran tidak menyebut nama provinsi atau negara yang dikenali sama
sekali (mis. typo total, atau nama daerah generik tanpa konteks). Targetnya nol lewat
perubahan ini, tapi kalau ada, pesannya tetap jujur dan gak menyembunyikan bahwa datanya ada.

## 7. Dependency baru

- `react-simple-maps` — komponen peta + pan/zoom.
- `d3-geo` (peer dependency `react-simple-maps`) — proyeksi & `geoCentroid`.
- `world-atlas` — data topologi dunia (`countries-110m.json`, resolusi rendah, ~100-200KB,
  dibundel statis, bukan network call saat runtime).
- `topojson-client` — konversi TopoJSON dari `world-atlas` ke GeoJSON yang dipakai
  `react-simple-maps`/`d3-geo`.

Ini penyimpangan sadar dari prinsip desain awal peta ("SVG inline, bukan library peta...
Tanpa tile server, tanpa API key") — sengaja diterima karena interaktivitas pan/zoom yang
diminta gak mungkin dicapai dengan SVG statis tangan. Tetap sejalan dengan semangat "tanpa
tile server/API key eksternal": semua data topologi dibundel statis, gak ada panggilan
jaringan ke pihak ketiga saat runtime.

## 8. Testing

`web/lib/geo/match-origin.test.ts` (Vitest, node environment — fungsi murni, gak perlu DOM):
- Origin yang menyebut negara luar Indonesia → cocok ke negara itu, bukan ke provinsi manapun.
- Origin yang menyebut provinsi Indonesia (termasuk dua contoh nyata yang sekarang gak
  kegambar: "Manglayang, Jawa Barat", "Mekarwangi, Jawa Barat") → cocok ke provinsi itu.
- Origin yang gak menyebut negara maupun provinsi yang dikenal → `undefined`.
- Nama negara yang jadi substring nama negara lain (kalau ada dalam daftar tes) → yang lebih
  panjang/spesifik menang, bukan yang duluan ditemukan.

Rendering peta (`react-simple-maps`, SVG, interaksi pan/zoom) sendiri gak dites otomatis —
konsisten dengan cakupan test yang ada sekarang di seluruh app ini (berhenti di layer logic,
bukan rendering visual/interaksi browser).

## 9. Bukan bagian dari pekerjaan ini

- Koordinat presisi per lot (geocoding API, input manual titik).
- Kolom database baru untuk menyimpan lokasi.
- Mengubah `COFFEE_REGIONS`/saran isian form tambah lot — itu tetap seperti sekarang, cuma
  dipakai bareng (bukan diganti) oleh daftar provinsi baru yang khusus buat peta.
- Styling ulang menyeluruh dashboard di luar komponen peta.

## 10. Risiko & hal terbuka

- **Ukuran bundle client bertambah** karena `react-simple-maps` + `d3-geo` + data topologi
  cuma dipakai komponen ini, tapi tetap nambah beban JS yang dikirim ke browser dibanding SVG
  tangan yang sebelumnya nyaris nol. Diterima sebagai konsekuensi langsung dari permintaan
  peta interaktif; Next.js akan code-split komponen client ini secara otomatis, jadi gak
  membengkakkan halaman lain di luar dashboard.
- **Resolusi topologi 110m (rendah)** dipilih supaya ukuran data tetap kecil — outline negara
  jadi disederhanakan, gak presisi untuk zoom sangat dekat. Cukup untuk kebutuhan "lihat kira-
  kira di mana", bukan buat navigasi presisi.
- **Nama negara di `world-atlas` harus cocok dengan cara pemilik app menulis origin.** Kalau
  suatu saat origin ditulis dengan ejaan yang beda jauh dari nama resmi PBB (mis. singkatan
  gak umum), gak akan kecocok dan lot itu masuk jaringan pengaman "gak kegambar" — sama seperti
  kasus provinsi Indonesia sekarang, cuma jauh lebih jarang karena nama negara pendek dan
  standar.
