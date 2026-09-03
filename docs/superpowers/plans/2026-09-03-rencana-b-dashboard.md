# Rencana B — Isi Dashboard, Keadaan Kosong, Peta

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Dashboard menampilkan umur roast, ke mana kopi pergi, siapa penerimanya, dan peta asal lot aktif — plus keadaan kosong yang tersusun, karena itulah tampilan yang dilihat sekarang.

**Architecture:** Dua fungsi agregat baru di `service.ts` (TDD lewat PGlite), satu helper tanggal di `format.ts`, satu outline Indonesia yang di-vendor sebagai JSON, dan komponen server yang menyusunnya. Tidak ada perubahan schema dan tidak ada library grafik.

**Tech Stack:** Next.js 16.3.4, React 19, Tailwind v4, Drizzle + Neon, Vitest + PGlite.

**Spec:** `docs/superpowers/specs/2026-09-03-dashboard-lot-lifecycle-design.md` §6a-6d, §7

---

## Yang perlu diketahui sebelum mulai

**Stok semua lot sekarang nol.** Jadi umur roast dan peta tidak akan menampilkan apa pun sampai lot baru dimasukkan. Itu bukan bug; itu justru alasan §7 (keadaan kosong) ada di rencana ini dan dikerjakan lebih awal, bukan belakangan.

**Aturan warna yang mengikat.** Amber adalah satu-satunya hue untuk bar: yang dikodekan besaran, bukan identitas. Jangan memberi warna berbeda per lot atau per penerima — itu membuat warna mengikuti peringkat, bukan entitas. Teal dipakai untuk IN, clay untuk OUT, dan keduanya sudah lolos uji buta warna (ΔE deutan 15,1); jangan menggantinya.

**Jangan membuat stacked bar untuk §6b.** Trio amber-teal-clay gagal uji pada pasangan amber/clay (ΔE 12,9, di bawah ambang 15 untuk penglihatan normal). Tiga baris satu warna menghindari masalah itu sepenuhnya.

## Struktur file

| File | Perubahan | Tanggung jawab |
|---|---|---|
| `web/lib/ledger/service.ts` | Modify | `outflowByReason`, `giftsByRecipient` |
| `web/lib/ledger/ledger.test.ts` | Modify | 6 test baru (20 → 26) |
| `web/lib/format.ts` | Modify | `daysSince(dateISO)` |
| `web/lib/regions.ts` | Modify | `findRegion` (sekarang ada pemanggilnya) |
| `web/lib/geo/indonesia.json` | Create | Outline Indonesia, Natural Earth, domain publik |
| `web/lib/geo/project.ts` | Create | lon/lat → x/y, proyeksi linier |
| `web/app/(app)/_dashboard/stat-tiles.tsx` | Create | Tiga angka headline |
| `web/app/(app)/_dashboard/stock-bars.tsx` | Create | Bar stok + umur roast |
| `web/app/(app)/_dashboard/outflow.tsx` | Create | Ke mana kopimu pergi |
| `web/app/(app)/_dashboard/recipients.tsx` | Create | Siapa yang dapat kopimu |
| `web/app/(app)/_dashboard/origin-map.tsx` | Create | Peta lot aktif |
| `web/app/(app)/page.tsx` | Modify | Susun panel + keadaan kosong |

Dashboard dipecah jadi komponen karena `page.tsx` akan jadi terlalu besar untuk dibaca sekaligus kalau semuanya ditumpuk di satu file. Semuanya Server Component; tidak ada yang butuh `"use client"`.

---

### Task 1: `daysSince` di format.ts

**Files:**
- Modify: `web/lib/format.ts`
- Modify: `web/lib/ledger/ledger.test.ts`

Umur roast dihitung dari `roastDate`, yang bertipe `date` (string `YYYY-MM-DD`), bukan timestamp. Tidak ada timezone yang perlu dikonversi; yang dibandingkan tanggal kalender di WIB.

- [x] **Step 1: Tulis test yang gagal**

Tambahkan `describe` baru di `web/lib/ledger/ledger.test.ts`, dan impor `daysSince` dari `"../format"`:

```ts
describe("daysSince", () => {
  it("menghitung selisih hari kalender", () => {
    expect(daysSince("2026-06-18", new Date("2026-09-03T00:00:00+07:00"))).toBe(77);
  });

  it("hari ini nol", () => {
    expect(daysSince("2026-09-03", new Date("2026-09-03T23:00:00+07:00"))).toBe(0);
  });

  it("tanggal besok negatif, bukan dilempar", () => {
    expect(daysSince("2026-09-04", new Date("2026-09-03T10:00:00+07:00"))).toBe(-1);
  });
});
```

- [x] **Step 2: Jalankan, pastikan MERAH**

Run: `cd web && npx vitest run`
Expected: gagal dengan `daysSince is not a function`. Laporkan pesan sebenarnya.

- [x] **Step 3: Implementasi**

Tambahkan ke `web/lib/format.ts`:

```ts
/**
 * Selisih hari kalender antara sebuah tanggal roast dan hari ini, dihitung di WIB.
 *
 * `roastDate` bertipe `date` di Postgres, jadi ia string `YYYY-MM-DD` tanpa jam dan
 * tanpa timezone. Yang dibandingkan tanggal kalender, bukan durasi, supaya jam
 * berapa pun di hari yang sama menghasilkan angka yang sama.
 */
export function daysSince(roastDate: string, now: Date = new Date()): number {
  const todayWIB = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(now);

  // Date.UTC menerima bulan berbasis nol, jadi bulannya dikurangi satu.
  // Keduanya dinormalkan ke tengah malam UTC supaya yang tersisa cuma selisih hari.
  const toUTC = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };

  return Math.round((toUTC(todayWIB) - toUTC(roastDate)) / 86_400_000);
}
```

- [x] **Step 4: Jalankan, pastikan HIJAU**

Run: `cd web && npx vitest run`
Expected: `23 passed`.

- [x] **Step 5: Commit**

```bash
git add web/lib/format.ts web/lib/ledger/ledger.test.ts
git commit -m "feat: daysSince buat umur roast

Bandingin tanggal kalender di WIB, bukan durasi, biar jam berapa pun di
hari yang sama ngasih angka yang sama.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 2: `outflowByReason` dan `giftsByRecipient` (TDD)

**Files:**
- Modify: `web/lib/ledger/service.ts`
- Modify: `web/lib/ledger/ledger.test.ts`

- [x] **Step 1: Tulis test yang gagal**

Pakai helper yang sudah ada di file itu (`freshDb`, `sampleLot`, dan gaya impor `service.xxx` yang dipakai test lain):

```ts
describe("outflowByReason", () => {
  it("hanya menghitung transaksi OUT, ACQUIRE diabaikan", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 1000);
    await service.recordBrew(db, lot.id, 60);
    await service.recordGift(db, lot.id, 240);

    const rows = await service.outflowByReason(db);

    expect(rows).toEqual([
      { reason: "GIFT", grams: 240 },
      { reason: "BREW", grams: 60 },
    ]);
  });

  it("urut menurun berdasarkan gram", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 500);
    await service.recordBrew(db, lot.id, 100);
    await service.recordGift(db, lot.id, 50);
    await service.recordAdjust(db, lot.id, 200, "OUT");

    expect((await service.outflowByReason(db)).map((r) => r.reason)).toEqual([
      "ADJUST",
      "BREW",
      "GIFT",
    ]);
  });

  it("database kosong menghasilkan array kosong", async () => {
    expect(await service.outflowByReason(await freshDb())).toEqual([]);
  });
});

describe("giftsByRecipient", () => {
  it("mengelompokkan catatan GIFT, tidak peka spasi dan besar-kecil huruf", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 1000);
    await service.recordGift(db, lot.id, 100, "Hapis");
    await service.recordGift(db, lot.id, 50, " hapis ");
    await service.recordGift(db, lot.id, 80, "Grey");

    expect(await service.giftsByRecipient(db)).toEqual([
      { recipient: "Hapis", grams: 150 },
      { recipient: "Grey", grams: 80 },
    ]);
  });

  it("catatan kosong masuk kelompok tanpa catatan", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 200);
    await service.recordGift(db, lot.id, 30);

    expect(await service.giftsByRecipient(db)).toEqual([
      { recipient: "(tanpa catatan)", grams: 30 },
    ]);
  });

  it("BREW dan ACQUIRE tidak ikut terhitung", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 500, "beli");
    await service.recordBrew(db, lot.id, 20, "V60");

    expect(await service.giftsByRecipient(db)).toEqual([]);
  });
});
```

- [x] **Step 2: Jalankan, pastikan MERAH**

Run: `cd web && npx vitest run`
Expected: gagal dengan `outflowByReason is not a function`. Laporkan pesan sebenarnya.

- [x] **Step 3: Implementasi**

Tambahkan ke `web/lib/ledger/service.ts`:

```ts
export interface OutflowRow { reason: TxnReason; grams: number; }
export interface RecipientRow { recipient: string; grams: number; }

/**
 * Gram yang keluar, dikelompokkan per alasan, urut menurun.
 *
 * Hanya transaksi OUT. ACQUIRE sengaja tidak ikut: yang masuk dan yang keluar
 * bukan bagian dari satu keseluruhan, jadi menampilkannya bersama akan berbohong
 * tentang proporsi.
 */
export async function outflowByReason(db: LedgerDb): Promise<OutflowRow[]> {
  const rows = await db
    .select({ reason: transaction.reason, grams: sum(transaction.grams) })
    .from(transaction)
    .where(eq(transaction.kind, "OUT"))
    .groupBy(transaction.reason);
  return rows
    .map((r) => ({ reason: r.reason, grams: Number(r.grams) }))
    .sort((a, b) => b.grams - a.grams);
}

/**
 * Gram hadiah per penerima, dibaca dari kolom catatan.
 *
 * Ini heuristik atas teks bebas: catatan pada transaksi GIFT kebetulan berisi nama
 * orang. Pengelompokan memangkas spasi dan mengabaikan besar-kecil huruf, lalu
 * menampilkan ejaan yang pertama kali muncul. Kalau penulisan nama nanti terlalu
 * beragam sampai hasilnya berantakan, itu sinyal bahwa penerima layak jadi kolom
 * sendiri, bukan alasan menambah kolom sekarang.
 */
export async function giftsByRecipient(db: LedgerDb): Promise<RecipientRow[]> {
  const rows = await db
    .select({ note: transaction.note, grams: transaction.grams })
    .from(transaction)
    .where(eq(transaction.reason, "GIFT"));

  const byKey = new Map<string, RecipientRow>();
  for (const r of rows) {
    const label = (r.note ?? "").trim() || "(tanpa catatan)";
    const key = label.toLowerCase();
    const existing = byKey.get(key);
    if (existing) existing.grams += r.grams;
    else byKey.set(key, { recipient: label, grams: r.grams });
  }
  return [...byKey.values()].sort((a, b) => b.grams - a.grams);
}
```

Tambahkan `sum` ke impor dari `drizzle-orm` kalau belum ada. Kalau nama tabel yang diimpor di file itu berbeda, pakai nama yang sebenarnya.

- [x] **Step 4: Jalankan, pastikan HIJAU**

Run: `cd web && npx vitest run`
Expected: `29 passed`.

- [x] **Step 5: Commit**

```bash
git add web/lib/ledger/service.ts web/lib/ledger/ledger.test.ts
git commit -m "feat: outflowByReason & giftsByRecipient

outflowByReason cuma ngitung OUT: yang masuk sama yang keluar bukan bagian
dari satu keseluruhan, jadi nampilinnya bareng bakal boong soal proporsi.

giftsByRecipient baca nama dari kolom catatan. Heuristik atas teks bebas,
dan itu disengaja: kalau nanti berantakan, berarti penerima emang layak
jadi kolom sendiri.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 3: Outline Indonesia dan proyeksinya

**Files:**
- Create: `web/lib/geo/indonesia.json`
- Create: `web/lib/geo/project.ts`
- Modify: `web/lib/regions.ts`

Sumbernya **Natural Earth**, yang secara eksplisit domain publik. Sudah diverifikasi: setelah diekstrak dan dibulatkan dua desimal, hasilnya 13 poligon, 250 titik, sekitar 3,7 KB, dan render-nya benar (Sumatra, Jawa, Kalimantan, Sulawesi, Papua terbaca; titik Kerinci, Rantekarua, dan Kintamani jatuh di tempatnya).

- [x] **Step 1: Ekstrak outline-nya**

```bash
cd web && mkdir -p lib/geo && cd lib/geo
curl -s --max-time 60 \
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson" \
  -o /tmp/ne110m.geojson
node -e '
const fs = require("fs");
const d = JSON.parse(fs.readFileSync("/tmp/ne110m.geojson", "utf8"));
const f = d.features.find(f => f.properties.ADM0_A3 === "IDN");
const c = f.geometry.coordinates.map(p => p.map(r => r.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)])));
fs.writeFileSync("indonesia.json", JSON.stringify({ type: "MultiPolygon", coordinates: c }));
const pts = c.flat(2).length;
console.log("poligon:", c.length, "titik:", pts, "bytes:", fs.statSync("indonesia.json").size);
'
rm -f /tmp/ne110m.geojson
```

Expected: `poligon: 13 titik: 250 bytes: 3711` (atau sangat dekat). Kalau jauh berbeda, berhenti dan laporkan — sumbernya mungkin berubah.

- [x] **Step 2: Buat `web/lib/geo/project.ts`**

```ts
import indonesia from "./indonesia.json";

/**
 * Proyeksi linier lon/lat ke koordinat SVG.
 *
 * Bukan proyeksi peta sungguhan. Untuk Indonesia yang membentang di ekuator dan
 * dirender selebar beberapa ratus piksel, distorsinya tidak terlihat, dan ini
 * menghindari ketergantungan pada d3-geo untuk tiga belas poligon.
 */
export const MAP_BOUNDS = { lon0: 94.5, lon1: 141.5, lat0: -11.0, lat1: 6.0 } as const;
export const MAP_SIZE = { width: 760, height: 300 } as const;

export function project(lon: number, lat: number): { x: number; y: number } {
  const { lon0, lon1, lat0, lat1 } = MAP_BOUNDS;
  return {
    x: ((lon - lon0) / (lon1 - lon0)) * MAP_SIZE.width,
    y: ((lat1 - lat) / (lat1 - lat0)) * MAP_SIZE.height,
  };
}

/** Outline Indonesia sebagai satu string `d` untuk `<path>`. */
export function indonesiaPath(): string {
  return (indonesia.coordinates as number[][][][])
    .flatMap((poly) =>
      poly.map((ring) => {
        const pts = ring.map(([lon, lat]) => {
          const { x, y } = project(lon, lat);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        return `M${pts.join("L")}Z`;
      }),
    )
    .join(" ");
}
```

Kalau TypeScript menolak impor JSON, aktifkan `resolveJsonModule` di `web/tsconfig.json`.

- [x] **Step 3: Tambahkan `findRegion` ke `web/lib/regions.ts`**

Sekarang ada yang memanggilnya, jadi ia bukan lagi kode mati:

```ts
/** Cocokkan teks origin ke region yang dikenal. Tidak peka besar-kecil huruf. */
export function findRegion(origin: string): CoffeeRegion | undefined {
  const needle = origin.trim().toLowerCase();
  return COFFEE_REGIONS.find((r) => r.name.toLowerCase() === needle);
}
```

- [x] **Step 4: Verifikasi**

Run: `cd web && npx tsc --noEmit && npx vitest run`
Expected: bersih, `29 passed`.

- [x] **Step 5: Commit**

```bash
git add web/lib/geo web/lib/regions.ts web/tsconfig.json
git commit -m "feat: outline Indonesia (Natural Earth, domain publik) + proyeksi

13 poligon, 250 titik, ~3.7 KB. Proyeksi linier, bukan proyeksi peta
beneran: di ekuator dan selebar beberapa ratus piksel distorsinya gak
kelihatan, dan ini ngehindarin d3-geo buat tiga belas poligon.

findRegion baru ditambahin sekarang, waktu udah ada yang manggil.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 4: Komponen dashboard

**Files:**
- Create: `web/app/(app)/_dashboard/stat-tiles.tsx`, `stock-bars.tsx`, `outflow.tsx`, `recipients.tsx`, `origin-map.tsx`
- Modify: `web/app/(app)/page.tsx`

Semuanya Server Component. Tidak ada `"use client"`, tidak ada library grafik, tidak ada tooltip: setiap bar sudah dilabeli langsung, dan satu seri tidak butuh legenda.

Token yang dipakai: `--ground --panel --panel-2 --line --ink --ink-dim --ink-faint --amber --teal --clay`, lewat utility Tailwind yang sudah ada (`bg-panel`, `text-ink-dim`, `border-line`, `font-display`, `font-mono`, `tabular-nums`).

- [x] **Step 1: `stat-tiles.tsx`**

Tiga angka: total stok, lot aktif, total lot. Props: `{ total: number; active: number; all: number }`. Pertahankan tampilan yang sekarang ada di `page.tsx` (kartu `bg-panel` dengan label mono kecil dan angka besar `font-display`); ini pemindahan, bukan perancangan ulang.

- [x] **Step 2: `stock-bars.tsx`**

Props: `{ rows: { name: string; stock: number; roastDate: string }[] }`.

Pertahankan bar yang sekarang: satu hue amber, sudut membulat 4px hanya di ujung data, tanpa track, nilai tepat di ujung bar, nama lot penuh tanpa elipsis, urut menurun.

Tambahkan umur roast sebagai baris kedua kecil di bawah nama lot: `{daysSince(roastDate)} hari sejak roast`, warna `text-ink-faint`. Kalau lebih dari 30, tambahkan ` · lewat masa prima` pada teks yang sama. **Tanpa warna status merah/kuning/hijau**: skalanya kontinu dan ambangnya selera, jadi angka plus label lebih jujur daripada lampu lalu lintas.

- [x] **Step 3: `outflow.tsx`**

Props: `{ rows: { reason: string; grams: number }[] }`.

Tiga baris berlabel, tiap baris: label alasan dalam bahasa Indonesia (`GIFT` → "Dikasih orang", `BREW` → "Diseduh", `ACQUIRE` tidak akan muncul, `ADJUST` → "Koreksi"), bar amber sepanjang proporsinya terhadap baris terbesar, lalu gram dan persentase terhadap total keluar.

Judul panel: "Ke mana kopimu pergi". Di bawahnya satu baris `text-ink-faint`: "Persentase dihitung dari total yang keluar, bukan dari yang masuk."

- [x] **Step 4: `recipients.tsx`**

Props: `{ rows: { recipient: string; grams: number }[] }`.

Bar horizontal satu hue amber, urut menurun, tiap bar dilabeli nama dan gram. Judul: "Siapa yang dapat kopimu". Tampilkan paling banyak 8 baris; kalau lebih, baris terakhir berbunyi `+N penerima lain`.

- [x] **Step 5: `origin-map.tsx`**

Props: `{ lots: { name: string; stock: number; origin: string }[] }` — hanya lot aktif yang dioper.

```tsx
import { findRegion } from "@/lib/regions";
import { indonesiaPath, project, MAP_SIZE } from "@/lib/geo/project";
```

Render `<svg viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`}>` dengan `className="w-full h-auto"`, satu `<path d={indonesiaPath()} fill="var(--panel-2)" stroke="var(--line)" strokeWidth="1" />`, lalu satu `<circle>` per lot yang origin-nya cocok, `fill="var(--amber)"`, jari-jari 4 sampai 10 piksel mengikuti akar kuadrat stok relatif terhadap stok terbesar (akar kuadrat supaya yang dibandingkan luas lingkaran, bukan jari-jarinya).

Beri tiap lingkaran `<title>` berisi nama lot dan gram, supaya terbaca pembaca layar dan muncul saat hover tanpa perlu komponen klien.

Lot yang origin-nya tidak cocok cukup tidak digambar. Kalau ada, tulis satu baris `text-ink-faint` di bawah peta: `N lot gak kegambar: origin-nya gak ada di daftar region.` Ini penting supaya tidak ada yang hilang diam-diam.

- [x] **Step 6: Susun ulang `page.tsx`**

```tsx
await requireSession();
```
tetap jadi pernyataan pertama.

Ambil data: `stockSummary(db)`, `outflowByReason(db)`, `giftsByRecipient(db)`. Jalankan bertiga lewat `Promise.all` supaya tidak jadi tiga round trip berurutan.

Susun:

1. `<StatTiles>` — selalu tampil, termasuk saat nol.
2. Kalau ada lot aktif: `<StockBars>` lalu `<OriginMap>`.
   Kalau tidak: satu panel ajakan, judul "Belum ada stok aktif", isi "Tambah lot dan isi stok awalnya di halaman Lots.", plus tautan ke `/lots` bergaya seperti tombol amber yang sudah ada.
3. Kalau `outflowByReason` tidak kosong: `<Outflow>`.
4. Kalau `giftsByRecipient` tidak kosong: `<Recipients>`.

Panel 3 dan 4 **tetap tampil walau stok nol**, karena keduanya bicara tentang masa lalu, bukan stok sekarang.

- [x] **Step 7: Verifikasi**

Run: `cd web && npx next typegen && npx tsc --noEmit && npx vitest run && npx next build`
Expected: bersih, `29 passed`, build sukses.

- [x] **Step 8: Lihat dengan mata, dua keadaan**

Cetak cookie sesi (cara yang sama seperti tugas sebelumnya di repo ini: `encode` dari `next-auth/jwt`, salt `authjs.session-token`, rahasia dari `../.env`), lalu dengan Playwright (`/Users/hilmi/anaconda3/bin/python`, viewport 1180x900, `device_scale_factor=2`):

**Keadaan A — kosong (keadaan sekarang):** buka `/`, screenshot ke `.../scratchpad/dash-empty.png`.
Yang harus benar: tiga kartu angka menampilkan `0 g`, `0`, `3`; ada ajakan ke `/lots`; **tidak ada** bar stok dan **tidak ada** peta; panel "Ke mana kopimu pergi" dan "Siapa yang dapat kopimu" **tetap tampil** dengan data lama.

**Keadaan B — ada stok:** lewat `/lots`, tambah lot `verify-dashboard` dengan origin `Toraja, Sulawesi Selatan` dan stok awal `300`. Buka `/`, screenshot ke `.../scratchpad/dash-full.png`.
Yang harus benar: bar stok muncul dengan umur roast `0 hari sejak roast`; peta muncul dengan satu titik di Sulawesi; angka total naik jadi `300 g`.

Kemudian **habiskan** lot itu lewat tombol Habiskan supaya database kembali ke keadaan semula, dan sebutkan di laporan bahwa lot `verify-dashboard` ditinggalkan dengan stok nol. Jangan menghapus baris apa pun.

**Lihat kedua screenshot** dan laporkan apa pun yang rusak: teks bertumpuk, kolom terpotong, titik peta di laut, bar yang meluber.

- [x] **Step 9: Commit**

```bash
git add web/
git commit -m "feat: dashboard berisi — umur roast, aliran keluar, penerima, peta

Bar tetap satu hue amber: yang dikodekan besaran, bukan identitas lot.
Aliran keluar dipisah jadi tiga baris, bukan stacked bar, karena trio
amber-teal-clay gagal uji buta warna di pasangan amber/clay.

Keadaan kosong ikut dirancang, bukan dibiarkan: stok lagi nol, jadi itu
justru tampilan pertama yang kelihatan.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

## Definisi selesai

- [x] `cd web && npx vitest run` → `29 passed`
- [x] `npx tsc --noEmit` bersih, `npx next build` sukses
- [x] `uv run pytest` → `22 passed` (tidak tersentuh)
- [x] Dashboard kosong menampilkan ajakan, bukan panel kosong
- [x] Dashboard berisi menampilkan bar stok dengan umur roast, dan peta dengan titik di tempat yang benar
- [x] "Ke mana kopimu pergi" tidak memasukkan ACQUIRE
- [x] Tidak ada library grafik atau peta yang ditambahkan
- [x] Database kembali ke stok nol setelah verifikasi, tanpa satu baris pun dihapus
