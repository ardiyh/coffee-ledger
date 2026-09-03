# Rencana C — Kolom Proses Pasca Panen & Saran Isian

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Proses pasca panen berhenti tersembunyi di dalam nama lot dan jadi kolom sendiri, dan tiga kolom teks bebas dapat saran isian yang tumbuh dari data yang benar-benar dipakai.

**Architecture:** Migrasi Drizzle menambah satu kolom nullable, service meneruskannya, satu fungsi agregat membaca nilai yang pernah dipakai, dan form menggabungkannya dengan daftar kurasi lewat `<datalist>` biasa.

**Tech Stack:** Next.js 16.3.4, Drizzle + Neon, Vitest + PGlite.

**Spec:** lanjutan dari `2026-09-03-dashboard-lot-lifecycle-design.md`; keputusan diambil langsung dalam percakapan, dicatat di §"Keputusan" di bawah.

---

## Keputusan yang sudah diambil

| Pertanyaan | Keputusan | Alasan |
|---|---|---|
| Nama kolom | `processMethod` (`process_method` di DB) | `process` itu global di Node; `const { process } = lot` akan menimpanya dan bug seperti itu sulit dilacak |
| Wajib atau tidak | **Wajib di form, nullable di database** | Nullable menyatakan yang sebenarnya: wajib mulai sekarang, baris lama boleh kosong. NOT NULL akan memaksa mengarang nilai untuk data impor yang tidak menyebut prosesnya |
| Backfill data lama | **Tidak perlu** | Database dikosongkan atas permintaan pemilik projek. Tabel kosong, jadi tidak ada yang perlu dipecah dari nama |
| Ejaan "Wethull" | wet-hulled alias **giling basah** | Dikonfirmasi pemilik projek |
| Sumber saran | Daftar kurasi **digabung** nilai yang pernah dipakai | Daftar kurasi menawarkan yang belum pernah dipakai; riwayat menyesuaikan diri dengan cara pemilik menulis dan menekan ejaan tidak konsisten di sumbernya |

**Waktunya kebetulan bagus:** tabel `lot` sekarang kosong (0 baris), jadi menambah kolom tidak bisa merusak data apa pun. Ini momen termurah untuk perubahan schema.

## Struktur file

| File | Perubahan | Tanggung jawab |
|---|---|---|
| `web/lib/ledger/schema.ts` | Modify | Kolom `processMethod` |
| `web/drizzle/00xx_*.sql` | Generated | Migrasi ALTER TABLE |
| `web/lib/ledger/service.ts` | Modify | Tipe `NewLotArgs`, teruskan `processMethod`, delegasi agregat |
| `web/lib/ledger/repository.ts` | Modify | Pindahan query agregat + `distinctLotValues` |
| `web/lib/ledger/ledger.test.ts` | Modify | 5 test baru (29 → 34) |
| `web/lib/coffee-vocab.ts` | Create | Daftar kurasi varietal & proses |
| `web/app/(app)/lots/add-lot-form.tsx` | Modify | Kolom proses (wajib) + tiga datalist |
| `web/app/(app)/lots/page.tsx` | Modify | Oper saran ke form, tampilkan kolom Proses |

---

### Task 1: Kolom `processMethod` dan migrasinya

**Files:**
- Modify: `web/lib/ledger/schema.ts`
- Generated: `web/drizzle/`

Sejak Streamlit pensiun, **Drizzle memiliki schema**, jadi alurnya sekarang: sunting `schema.ts`, `generate`, lalu `migrate`. Ini pertama kalinya alur itu dipakai di projek ini.

- [x] **Step 1: Tambahkan kolom ke `schema.ts`**

Di `web/lib/ledger/schema.ts`, di dalam `pgTable("lot", {...})`, sisipkan setelah `varietal`:

```ts
	processMethod: varchar("process_method"),
```

Tanpa `.notNull()`. Nullable disengaja; lihat tabel Keputusan di atas.

- [x] **Step 2: Generate migrasinya**

Run: `cd web && npx drizzle-kit generate`
Expected: file baru `drizzle/0001_*.sql`.

- [x] **Step 3: BACA file SQL yang dihasilkan sebelum menjalankannya**

Run: `cd web && cat drizzle/0001_*.sql`
Expected: satu pernyataan, kira-kira `ALTER TABLE "lot" ADD COLUMN "process_method" varchar;`

**Kalau file itu berisi `CREATE TABLE`, `DROP`, atau apa pun selain satu `ADD COLUMN`, BERHENTI dan laporkan.** Itu berarti Drizzle mengira schema-nya berbeda jauh dari isi database, dan menjalankannya bisa merusak.

- [x] **Step 4: Jalankan migrasinya**

Run: `cd web && npx drizzle-kit migrate`

Catatan: `drizzle/0000_*.sql` adalah baseline hasil introspect dan **seluruh isinya dibungkus komentar `/* */`**, jadi menjalankannya tidak melakukan apa-apa. Drizzle akan mencatatnya sebagai sudah diterapkan lalu lanjut ke 0001. Kalau langkah ini gagal karena 0000, laporkan pesannya; jangan mengakalinya dengan `drizzle-kit push`.

- [x] **Step 5: Verifikasi kolomnya benar-benar ada**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData && uv run python - <<'PY'
import pathlib, re
from sqlalchemy import create_engine, text
url = re.search(r'DATABASE_URL=(.+)', pathlib.Path(".env").read_text()).group(1).strip()
with create_engine(url).connect() as c:
    for r in c.execute(text("""
        SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_name='lot' ORDER BY ordinal_position""")):
        print(f"  {r[0]:<16} {r[1]:<28} nullable={r[2]}")
PY
```

Expected: `process_method character varying nullable=YES` muncul dalam daftar.

- [x] **Step 6: Commit**

```bash
git add web/lib/ledger/schema.ts web/drizzle
git commit -m "feat: kolom process_method di tabel lot

Proses pasca panen tadinya nyempil di dalam nama lot ('Kayu Aro - Natural
Anaerob'). Sekarang kolom sendiri, biar bisa dianalisa di Fase 5.

Nullable di DB, wajib di form: nullable nyatain yang sebenernya, yaitu
wajib mulai sekarang dan baris lama boleh kosong.

Migrasi pertama sejak Drizzle megang schema.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 2: Teruskan `processMethod` lewat service (TDD)

**Files:**
- Modify: `web/lib/ledger/service.ts`
- Modify: `web/lib/ledger/ledger.test.ts`

Tipe argumen lot saat ini diketik ulang di dua tempat, di `addLot` dan `addLotWithInitialStock`. Menambah satu field berarti menyunting keduanya, dan suatu saat keduanya akan berbeda. Diekstrak jadi satu tipe. Ini kode yang memang sedang disentuh, bukan refactor terpisah.

- [x] **Step 1: Tulis test yang gagal**

Pakai helper yang ada (`freshDb`, `sampleLot`, gaya impor `service.xxx`):

```ts
describe("processMethod", () => {
  const args = {
    name: "Gayo Wine",
    origin: "Gayo, Aceh",
    varietal: "Typica",
    roastDate: "2026-09-01",
  };

  it("tersimpan waktu diberikan", async () => {
    const db = await freshDb();
    const lot = await service.addLot(db, { ...args, processMethod: "Giling Basah" });

    const stored = (await service.listLots(db)).find((l) => l.id === lot.id);
    expect(stored?.processMethod).toBe("Giling Basah");
  });

  it("null waktu tidak diberikan", async () => {
    const db = await freshDb();
    const lot = await service.addLot(db, args);

    const stored = (await service.listLots(db)).find((l) => l.id === lot.id);
    expect(stored?.processMethod).toBeNull();
  });
});
```

- [x] **Step 2: Jalankan, pastikan MERAH**

Run: `cd web && npx vitest run`
Expected: gagal karena `processMethod` bukan properti yang dikenal, atau nilainya `undefined`. Laporkan pesan sebenarnya.

- [x] **Step 3: Implementasi**

Di `web/lib/ledger/service.ts`, ganti dua tipe inline itu dengan satu tipe bersama, diletakkan tepat sebelum `addLot`:

```ts
export interface NewLotArgs {
  name: string;
  origin: string;
  varietal: string;
  roastDate: string;
  /**
   * Proses pasca panen: Natural, Washed, Giling Basah, dan seterusnya.
   *
   * Opsional di sini walaupun form mewajibkannya. Database mengizinkan null
   * supaya data yang masuk lewat jalur lain (impor, skrip) tidak perlu
   * mengarang nilai untuk sesuatu yang memang tidak diketahui.
   */
  processMethod?: string | null;
  notes?: string | null;
}
```

Ubah tanda tangan `addLot` dan `addLotWithInitialStock` agar keduanya memakai `args: NewLotArgs`, dan tambahkan `processMethod: args.processMethod ?? null` ke objek `newLot` di dalam `addLot`.

- [x] **Step 4: Jalankan, pastikan HIJAU**

Run: `cd web && npx vitest run`
Expected: `31 passed`.

- [x] **Step 5: Commit**

```bash
git add web/lib/ledger/service.ts web/lib/ledger/ledger.test.ts
git commit -m "feat: service nerusin processMethod

Tipe argumen lot diekstrak jadi NewLotArgs: tadinya diketik ulang di dua
fungsi, dan nambah satu field berarti nyunting dua-duanya.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 3: Kembalikan SQL ke repository (bereskan dulu)

**Files:**
- Modify: `web/lib/ledger/repository.ts`
- Modify: `web/lib/ledger/service.ts`

`service.ts` menyatakan sendiri di docstring-nya: *"No SQL here — data access is
delegated to repository.ts."* Tapi `outflowByReason` dan `giftsByRecipient` yang
ditambahkan di Rencana B berisi SQL langsung di sana: keduanya mengimpor tabel
`transaction` dari `./schema` dan memanggil `db.select()`.

Itu kesalahan instruksi di rencana sebelumnya, bukan kesalahan yang menulis. Dibereskan
sekarang selagi baru dua fungsi, sebelum Task 4 menambah yang ketiga dan polanya telanjur
mengeras.

**Tidak ada test baru.** 31 test yang ada adalah jaringnya: perilakunya tidak boleh berubah
sedikit pun.

- [x] **Step 1: Catat titik awal**

Run: `cd web && npx vitest run`
Expected: `31 passed`. Angka ini harus sama persis di akhir.

- [x] **Step 2: Pindahkan query-nya ke `repository.ts`**

Pindahkan badan `outflowByReason` dan `giftsByRecipient` apa adanya ke
`web/lib/ledger/repository.ts`, beserta tipe `OutflowRow` dan `RecipientRow`. Pindahkan juga
impor yang mereka butuhkan. Jangan mengubah logikanya sama sekali, termasuk pengurutan dan
penanganan catatan kosong.

- [x] **Step 3: Service mendelegasikan**

Di `service.ts`, ganti keduanya menjadi pemanggilan tipis ke repository, dan **pertahankan
komentar dokumentasinya di service** karena yang dijelaskan di sana adalah aturannya (kenapa
ACQUIRE dikecualikan, kenapa pengelompokan penerima itu heuristik), bukan cara query-nya
bekerja:

```ts
export async function outflowByReason(db: LedgerDb): Promise<repo.OutflowRow[]> {
  return repo.outflowByReason(db);
}

export async function giftsByRecipient(db: LedgerDb): Promise<repo.RecipientRow[]> {
  return repo.giftsByRecipient(db);
}
```

Ekspor ulang tipenya dari service kalau ada komponen yang mengimpornya dari sana.

- [x] **Step 4: Pastikan tak ada SQL yang tersisa di service**

Run: `cd web && grep -n 'db.select\|from "./schema"' lib/ledger/service.ts`
Expected: tidak ada hasil.

- [x] **Step 5: Perilaku tidak berubah**

Run: `cd web && npx vitest run && npx tsc --noEmit && npx next build`
Expected: `31 passed`, tipe bersih, build sukses. Kalau jumlah test berubah, ada yang salah.

- [x] **Step 6: Commit**

```bash
git add web/lib/ledger/service.ts web/lib/ledger/repository.ts
git commit -m "refactor: balikin SQL ke repository

service.ts bilang sendiri 'No SQL here', tapi outflowByReason sama
giftsByRecipient yang ditambahin di Rencana B naro query langsung di situ.
Itu salah instruksi rencananya, bukan salah yang nulis.

Perilakunya gak berubah: 31 test yang sama tetep ijo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 4: `distinctLotValues` (TDD)

**Files:**
- Modify: `web/lib/ledger/service.ts`
- Modify: `web/lib/ledger/ledger.test.ts`

Ini yang membuat saran isian tumbuh dari data sendiri, bukan cuma dari daftar kurasi.

**Query-nya ke `repository.ts`, service mendelegasikan** — mengikuti pemisahan yang baru
dipulihkan di Task 3. Jangan menaruh `db.select()` di `service.ts`.

- [x] **Step 1: Tulis test yang gagal**

```ts
describe("distinctLotValues", () => {
  const base = { name: "x", origin: "Gayo, Aceh", varietal: "Typica", roastDate: "2026-09-01" };

  it("mengembalikan nilai unik, yang paling sering di depan", async () => {
    const db = await freshDb();
    await service.addLot(db, { ...base, varietal: "Typica" });
    await service.addLot(db, { ...base, varietal: "Ateng" });
    await service.addLot(db, { ...base, varietal: "Typica" });

    const v = await service.distinctLotValues(db);
    expect(v.varietals).toEqual(["Typica", "Ateng"]);
    expect(v.origins).toEqual(["Gayo, Aceh"]);
  });

  it("melewati processMethod yang null", async () => {
    const db = await freshDb();
    await service.addLot(db, base);
    await service.addLot(db, { ...base, processMethod: "Giling Basah" });

    expect((await service.distinctLotValues(db)).processMethods).toEqual(["Giling Basah"]);
  });

  it("database kosong menghasilkan tiga array kosong", async () => {
    expect(await service.distinctLotValues(await freshDb())).toEqual({
      origins: [], varietals: [], processMethods: [],
    });
  });
});
```

- [x] **Step 2: Jalankan, pastikan MERAH**

Run: `cd web && npx vitest run`
Expected: gagal dengan `distinctLotValues is not a function`. Laporkan pesan sebenarnya.

- [x] **Step 3: Implementasi**

```ts
export interface LotValueSuggestions {
  origins: string[];
  varietals: string[];
  processMethods: string[];
}

/**
 * Nilai yang pernah dipakai di kolom teks bebas, yang paling sering di depan.
 *
 * Dipakai untuk mengisi `<datalist>` di form tambah lot. Tujuannya bukan cuma
 * mempercepat ketik: menawarkan ejaan yang sudah pernah dipakai menekan
 * penulisan tidak konsisten di sumbernya, yang kalau dibiarkan akan memecah
 * satu varietal jadi dua di analisa nanti.
 */
export async function distinctLotValues(db: LedgerDb): Promise<LotValueSuggestions> {
  const rows = await db
    .select({
      origin: lot.origin,
      varietal: lot.varietal,
      processMethod: lot.processMethod,
    })
    .from(lot);

  const rank = (values: (string | null)[]) => {
    const count = new Map<string, number>();
    for (const v of values) {
      const s = (v ?? "").trim();
      if (s) count.set(s, (count.get(s) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
  };

  return {
    origins: rank(rows.map((r) => r.origin)),
    varietals: rank(rows.map((r) => r.varietal)),
    processMethods: rank(rows.map((r) => r.processMethod)),
  };
}
```

- [x] **Step 4: Jalankan, pastikan HIJAU**

Run: `cd web && npx vitest run`
Expected: `34 passed`.

- [x] **Step 5: Commit**

```bash
git add web/lib/ledger/service.ts web/lib/ledger/ledger.test.ts
git commit -m "feat: distinctLotValues buat saran isian

Nawarin ejaan yang udah pernah dipake nekan penulisan gak konsisten di
sumbernya, yang kalau dibiarin bakal mecah satu varietal jadi dua pas
dianalisa nanti.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 5: Daftar kurasi

**Files:**
- Create: `web/lib/coffee-vocab.ts`

Terpisah dari `regions.ts` karena file itu khusus geografi dan punya koordinat; ini kosakata tanpa koordinat.

- [x] **Step 1: Buat filenya**

```ts
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
```

Catatan: "Giling Basah" adalah wet-hulled, dikonfirmasi pemilik projek. Ditulis dalam bahasa Indonesia karena itu istilah yang dipakai di sini.

- [x] **Step 2: Cek tipe dan commit**

Run: `cd web && npx tsc --noEmit`

```bash
git add web/lib/coffee-vocab.ts
git commit -m "feat: daftar kurasi varietal & proses pasca panen

Daftar kurasi, bukan hasil scraping: domainnya kecil dan stabil, jadi
ditulis sekali bukan dirawat sebagai pipeline. Digabung sama nilai yang
pernah dipake pas runtime.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 6: Form dan tabel lot

**Files:**
- Modify: `web/app/(app)/lots/add-lot-form.tsx`
- Modify: `web/app/(app)/lots/page.tsx`
- Modify: `web/app/(app)/actions.ts`

**Keamanan:** `await requireSession()` tetap pernyataan pertama di `addLotAction` dan di halaman. Jangan diubah.

- [x] **Step 1: Halaman mengambil saran dan meneruskannya**

Di `web/app/(app)/lots/page.tsx`, ambil `distinctLotValues(db)` bersamaan dengan `stockSummary(db)` lewat `Promise.all`, lalu gabungkan dengan daftar kurasi dan oper ke `<AddLotForm>` sebagai satu prop:

```tsx
import { COFFEE_REGIONS } from "@/lib/regions";
import { VARIETALS, PROCESS_METHODS } from "@/lib/coffee-vocab";
import { distinctLotValues, stockSummary } from "@/lib/ledger/service";

const [lots, used] = await Promise.all([
  stockSummary(db),
  distinctLotValues(db),
]);

const merge = (used: string[], curated: readonly string[]) => [
  ...used,
  ...curated.filter((c) => !used.some((u) => u.toLowerCase() === c.toLowerCase())),
];

const suggestions = {
  origins: merge(used.origins, COFFEE_REGIONS.map((r) => r.name)),
  varietals: merge(used.varietals, VARIETALS),
  processMethods: merge(used.processMethods, PROCESS_METHODS),
};
```

Nilai yang pernah dipakai ditaruh **di depan** supaya yang sering dipakai muncul duluan, dan pencocokan tidak peka besar-kecil huruf supaya `"typica"` yang pernah diketik tidak memunculkan `"Typica"` sebagai entri kedua.

- [x] **Step 2: Form menerima prop dan merender tiga datalist**

Di `add-lot-form.tsx`, terima prop `suggestions: { origins: string[]; varietals: string[]; processMethods: string[] }`.

Ganti `<datalist id="coffee-regions">` yang sekarang diisi dari `COFFEE_REGIONS` agar diisi dari `suggestions.origins`. Hapus impor `COFFEE_REGIONS` dari file ini kalau jadi tidak terpakai.

Tambahkan `list="varietals"` pada input varietal, dan `<datalist id="varietals">` yang diisi `suggestions.varietals`.

Tambahkan kolom baru setelah varietal:

```tsx
      <label className="flex flex-col gap-1">
        <span className={labelClass}>Proses pasca panen</span>
        <input
          name="processMethod"
          type="text"
          required
          list="process-methods"
          className={inputClass}
          placeholder="Giling Basah"
        />
        <datalist id="process-methods">
          {suggestions.processMethods.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>
```

- [x] **Step 3: Action membaca dan meneruskannya**

Di `web/app/(app)/actions.ts`, di dalam `addLotAction`, baca `processMethod` dari `formData`, ikutkan ke pemeriksaan wajib yang sudah ada, dan teruskan ke `addLotWithInitialStock`:

```ts
  const processMethod = String(formData.get("processMethod") ?? "").trim();
```

Ubah pemeriksaan wajibnya menjadi menyertakan `processMethod`, dengan pesan `"Nama, origin, varietal, proses, dan tanggal roast wajib diisi."`, lalu oper `processMethod` di dalam objek args.

- [x] **Step 4: Tampilkan kolomnya di tabel lot**

Di `page.tsx`, tambahkan satu `<th>` "Proses" setelah Varietal dan `<td>` yang sesuai. Tampilkan `lot.processMethod ?? "—"` dengan `text-ink-faint` kalau kosong, supaya baris lama yang null terlihat sebagai tidak diisi, bukan sebagai kosong yang membingungkan.

- [x] **Step 5: Verifikasi**

Run: `cd web && npx next typegen && npx tsc --noEmit && npx vitest run && npx next build`
Expected: bersih, `34 passed`, build sukses.

- [x] **Step 6: Buktikan sampai ke database, dan lihat dengan mata**

Cetak cookie sesi seperti tugas sebelumnya di repo ini (`encode` dari `next-auth/jwt`, salt `authjs.session-token`, rahasia dari `../.env`), lalu dengan Playwright (`/Users/hilmi/anaconda3/bin/python`, viewport 1180x900, `device_scale_factor=2`):

Database **kosong** saat ini (0 lot, 0 transaksi). Jadi:

1. Buka `/lots`. Periksa dropdown Proses pasca panen berisi daftar kurasi (Natural, Washed, Giling Basah, dan seterusnya) walaupun belum ada data.
2. Tambah lot: nama `Gayo Wine Natural`, origin `Gayo, Aceh` dari datalist, varietal `Typica`, **proses `Giling Basah`**, stok awal `500`.
3. Muat ulang `/lots`. Sekarang periksa `Giling Basah` dan `Typica` muncul **di posisi paling atas** dropdown masing-masing, karena nilai terpakai ditaruh di depan.
4. Pastikan tabel menampilkan kolom Proses berisi `Giling Basah`.
5. Buka `/` dan pastikan dashboard hidup: stok 500 g, satu bar, satu titik peta di Aceh.

Ambil screenshot penuh `/lots` dan `/` ke `.../scratchpad/lots-proses.png` dan `.../scratchpad/dash-proses.png`. **Lihat keduanya** dan laporkan apa pun yang rusak.

**Tinggalkan lot itu di database.** Ini lot sungguhan yang berguna sebagai isi awal, bukan artefak uji, dan pemilik projek memang perlu data untuk dilihat. Beri tahu di laporan bahwa lot `Gayo Wine Natural` 500 g ditinggalkan.

Hapus skrip sementara dan berkas token; `git status` harus bersih sebelum commit.

- [x] **Step 7: Commit**

```bash
git add web/
git commit -m "feat: kolom proses di form & tabel, plus saran isian

Tiga kolom teks bebas sekarang dapet datalist: daftar kurasi digabung nilai
yang pernah dipake, yang kepake ditaro di depan.

Proses wajib diisi di form walau kolomnya nullable di DB — wajib mulai
sekarang, baris lama boleh kosong.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

## Definisi selesai

- [x] `cd web && npx vitest run` → `34 passed`
- [x] `grep 'db.select' lib/ledger/service.ts` → tidak ada hasil; SQL kembali di repository
- [x] `uv run pytest` → `22 passed` (tidak tersentuh)
- [x] `npx tsc --noEmit` bersih, `npx next build` sukses
- [x] `information_schema` menunjukkan `process_method`, nullable
- [x] Migrasi Drizzle tersimpan di `web/drizzle/` dan sudah diterapkan
- [x] Ketiga kolom punya dropdown saran, dan nilai terpakai muncul di depan
- [x] Proses wajib diisi di form; kolomnya tetap nullable di database
- [x] Ada satu lot sungguhan di database supaya dashboard tidak kosong
