# Rencana A — Pensiun Streamlit, Font Geist, Siklus Hidup Lot

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Streamlit pensiun, font display keluar dari kluster default LLM, dan mengisi lot baru turun dari dua langkah jadi satu.

**Architecture:** Dua fungsi baru di `service.ts` (`finishLot`, `addLotWithInitialStock`) yang dites lewat Vitest + PGlite, lalu dipakai tipis oleh Server Action. Daftar region kopi jadi data statis di `lib/regions.ts`, dipakai `<datalist>` supaya input lebih cepat sekaligus menyiapkan koordinat untuk peta di Rencana B.

**Tech Stack:** Next.js 16.3.4, React 19, Tailwind v4, Drizzle + Neon, Vitest + PGlite, `next/font`.

**Spec:** `docs/superpowers/specs/2026-09-03-dashboard-lot-lifecycle-design.md` (§3 font, §4 pensiun, §5a-5c siklus lot)

---

## Ruang lingkup

Rencana ini **hanya bagian A**. Isi dashboard (§6), keadaan kosong (§7), dan peta adalah Rencana B, ditulis setelah A selesai — karena dashboard yang diperkaya baru bisa dilihat setelah ada lot aktif, dan lot aktif itu justru yang dibuat oleh rencana ini.

## Struktur file

| File | Perubahan | Tanggung jawab |
|---|---|---|
| `web/lib/ledger/service.ts` | Modify | Tambah `finishLot`, `addLotWithInitialStock` |
| `web/lib/ledger/ledger.test.ts` | Modify | 6 test baru (14 → 20) |
| `web/lib/regions.ts` | Create | Daftar region kopi Indonesia + koordinat |
| `web/app/(app)/actions.ts` | Modify | `finishLotAction`, `addLotAction` terima gram awal |
| `web/app/(app)/lots/add-lot-form.tsx` | Modify | Kolom gram awal + datalist region |
| `web/app/(app)/lots/finish-lot-button.tsx` | Create | Tombol Habiskan + konfirmasi |
| `web/app/(app)/lots/page.tsx` | Modify | Kolom aksi berisi tombol Habiskan |
| `web/app/layout.tsx` | Modify | Geist + Geist Mono |
| `web/app/globals.css` | Modify | Token font |
| `app/app.py`, `requirements.txt`, `.streamlit/` | Delete | Streamlit pensiun |
| `README.md` | Modify | Status fase, kepemilikan schema |

---

### Task 1: Ganti font ke Geist

**Files:**
- Modify: `web/app/layout.tsx`
- Modify: `web/app/globals.css`

Fraunces ditandai `taste-skill` sebagai satu dari dua serif default favorit LLM. Ia pilihan asisten, bukan pilihan pemilik projek, jadi tidak ada pembelaan brand untuknya. Palet **tidak** ikut berubah. Tiga keluarga font jadi dua.

- [ ] **Step 1: Ganti isi `web/app/layout.tsx` seluruhnya**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Coffee Ledger",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body bg-ground text-ink">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Perbarui token font di `web/app/globals.css`**

Cari tiga baris ini (sekitar baris 42-44) dan ganti:

```css
  --font-display: var(--font-fraunces);
  --font-body: var(--font-karla);
  --font-mono: var(--font-plex-mono);
```

menjadi:

```css
  --font-display: var(--font-geist);
  --font-body: var(--font-geist);
  --font-mono: var(--font-geist-mono);
```

Nama utility `font-display`, `font-body`, `font-mono` **tidak berubah**, jadi tidak ada komponen yang perlu disentuh. Display dan body kini keluarga yang sama; perbedaannya dibawa berat huruf, bukan keluarga.

- [ ] **Step 3: Pastikan tak ada sisa nama font lama**

Run: `cd web && grep -rn "fraunces\|karla\|plex" app lib --include=*.tsx --include=*.ts --include=*.css -i`
Expected: tidak ada hasil. Kalau ada, ganti sisanya.

- [ ] **Step 4: Build & test**

Run: `cd web && npx next build && npx vitest run`
Expected: build sukses, `14 passed`.

- [ ] **Step 5: Commit**

```bash
git add web/app/layout.tsx web/app/globals.css
git commit -m "refactor: ganti font display ke Geist

Fraunces ditandai taste-skill sebagai serif default favorit LLM, dan itu
pilihan asisten bukan pilihan pemilik projek. Tiga keluarga font jadi dua;
display dan body sekarang Geist, dibedakan berat bukan keluarga.

Palet gak ikut berubah: ambernya datang dari config.toml yang ditulis
sendiri, jadi itu warna brand yang sah.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 2: Pensiunkan Streamlit

**Files:**
- Delete: `app/app.py`, `requirements.txt`, `.streamlit/config.toml`, `.streamlit/secrets.toml.example`
- Delete: `tests/test_app.py`
- Modify: `README.md`

`src/coffee_ledger/` **tetap ada** sebagai jalur baca Python untuk EDA Fase 5. Yang dihapus hanya UI Streamlit dan berkas khusus deploy-nya. `tests/test_app.py` ikut karena ia menguji `app/app.py` lewat AppTest dan akan gagal tanpa file itu.

- [ ] **Step 1: Catat jumlah test Python sebelum menghapus**

Run: `uv run pytest 2>&1 | tail -1`
Expected: `23 passed`. Catat angkanya.

- [ ] **Step 2: Hapus berkas Streamlit**

```bash
git rm app/app.py requirements.txt .streamlit/config.toml .streamlit/secrets.toml.example tests/test_app.py
rmdir app .streamlit 2>/dev/null || true
```

- [ ] **Step 3: Jalankan test Python**

Run: `uv run pytest 2>&1 | tail -1`
Expected: `22 passed` (23 dikurangi satu test AppTest). Kalau angkanya lain, laporkan; jangan sesuaikan test agar hijau.

- [ ] **Step 4: Perbarui README.md**

Di bagian Roadmap, ganti baris Fase 3 dan 4 sehingga terbaca:

```markdown
- [x] **Fase 3** — Deploy (Streamlit Cloud + Postgres)
- [x] **Fase 4** — Pindah ke Next.js + Vercel; Streamlit pensiun
- [ ] **Fase 5** — Analisa (EDA)
```

Di bagian Arsitektur, ganti blok diagram menjadi:

```
UI (Next.js di Vercel)  →  web/lib/ledger/ (core TypeScript, tested)  →  Neon Postgres
                                                                       ↑
                                     src/coffee_ledger/ (jalur baca Python buat EDA)
```

Tambahkan bagian baru tepat setelah Arsitektur:

```markdown
## Kepemilikan schema

Sejak Streamlit pensiun, **Drizzle yang memiliki schema**. Perubahan kolom lewat
`drizzle-kit generate` + `drizzle-kit migrate` dari dalam `web/`.

`src/coffee_ledger/` dipertahankan sebagai jalur baca Python untuk analisa (pandas,
notebook). Model SQLModel-nya bisa tertinggal dari schema kalau Drizzle menambah kolom;
untuk membaca kolom lama itu tidak masalah, dan itu satu-satunya yang dibutuhkan EDA.
Jangan menjalankan `SQLModel.metadata.create_all()` terhadap database produksi lagi.
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: pensiunkan Streamlit, Drizzle ambil alih schema

Next.js udah setara. app/app.py, requirements.txt, .streamlit/, dan
test_app.py dihapus. src/coffee_ledger/ tetap sebagai jalur baca Python
buat EDA Fase 5.

Aturan 'Drizzle cuma introspect' dicabut: mulai sekarang perubahan schema
lewat drizzle-kit generate + migrate.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

- [ ] **Step 6: Matikan deploy Streamlit Cloud**

Ini langkah manual pemilik projek, bukan agent: di share.streamlit.io, hapus app-nya. Catat di laporan bahwa langkah ini menunggu pemilik projek.

---

### Task 3: `finishLot` di service (TDD)

**Files:**
- Modify: `web/lib/ledger/service.ts`
- Modify: `web/lib/ledger/ledger.test.ts`

Menghabiskan lot berarti **mencatat koreksi keluar sebesar sisa stok**, bukan menghapus apa pun. Stok dihitung dari transaksi, jadi menghapus transaksi berarti mengarang ulang sejarah.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `web/lib/ledger/ledger.test.ts`, mengikuti pola `describe`/fixture yang sudah ada di file itu (pakai `freshDb()` dan helper lot yang sama seperti test lain):

```ts
describe("finishLot", () => {
  it("mencatat koreksi keluar sebesar sisa stok", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await recordAcquire(db, lot.id, 250);

    await finishLot(db, lot.id);

    expect(await currentStock(db, lot.id)).toBe(0);
    const txns = await history(db, lot.id);
    const last = txns[txns.length - 1];
    expect(last.kind).toBe("OUT");
    expect(last.reason).toBe("ADJUST");
    expect(last.grams).toBe(250);
    expect(last.note).toBe("habis");
  });

  it("riwayat tetap utuh, tidak ada yang dihapus", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await recordAcquire(db, lot.id, 250);
    await recordBrew(db, lot.id, 18);

    await finishLot(db, lot.id);

    expect((await history(db, lot.id)).length).toBe(3);
  });

  it("menolak lot yang stoknya sudah nol", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);

    await expect(finishLot(db, lot.id)).rejects.toThrow(InvalidQuantityError);
  });
});
```

Kalau nama helper di file itu berbeda dari `freshDb`/`sampleLot`, pakai nama yang sebenarnya ada di sana. Jangan bikin helper baru.

- [ ] **Step 2: Jalankan, pastikan MERAH**

Run: `cd web && npx vitest run`
Expected: gagal dengan `finishLot is not defined` (atau error impor serupa). Laporkan pesan sebenarnya.

- [ ] **Step 3: Implementasi**

Tambahkan ke `web/lib/ledger/service.ts`, setelah `recordAdjust`:

```ts
/**
 * Habiskan lot: catat koreksi keluar sebesar sisa stoknya.
 *
 * Bukan menghapus. Stok dihitung dari transaksi, jadi menghapus transaksi
 * berarti mengarang ulang sejarah. Lot berstok nol adalah keadaan yang sah.
 *
 * Stok nol ditolak lewat `record()` yang sudah menolak grams <= 0.
 */
export async function finishLot(
  db: LedgerDb,
  lotId: number,
): Promise<Transaction> {
  const stock = await currentStock(db, lotId);
  return recordAdjust(db, lotId, stock, "OUT", "habis");
}
```

- [ ] **Step 4: Jalankan, pastikan HIJAU**

Run: `cd web && npx vitest run`
Expected: `17 passed` (14 lama + 3 baru).

- [ ] **Step 5: Commit**

```bash
git add web/lib/ledger/service.ts web/lib/ledger/ledger.test.ts
git commit -m "feat: finishLot — habiskan lot lewat koreksi, bukan hapus

Stok dihitung dari transaksi, jadi menghapus transaksi berarti ngarang
ulang sejarah. Habiskan = catat ADJUST OUT sebesar sisa stok.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 4: `addLotWithInitialStock` di service (TDD)

**Files:**
- Modify: `web/lib/ledger/service.ts`
- Modify: `web/lib/ledger/ledger.test.ts`

Sekarang mengisi lot baru butuh dua langkah di dua halaman. Ini menggabungkannya.

**Tanpa rollback, dan itu disengaja:** kalau pencatatan ACQUIRE gagal setelah lot terbuat, lot tetap ada dengan stok nol. Membuat lot dan mencatat transaksi adalah dua fakta terpisah di buku besar, dan lot berstok nol adalah keadaan yang sah.

- [ ] **Step 1: Tulis test yang gagal**

```ts
describe("addLotWithInitialStock", () => {
  const args = {
    name: "Gayo Bener Kelipah",
    origin: "Gayo, Aceh",
    varietal: "Red Bourbon",
    roastDate: "2026-06-20",
  };

  it("tanpa gram awal: lot dibuat, stok nol, tanpa transaksi", async () => {
    const db = await freshDb();

    const lot = await addLotWithInitialStock(db, args);

    expect(lot.id).toBeDefined();
    expect(await currentStock(db, lot.id)).toBe(0);
    expect((await history(db, lot.id)).length).toBe(0);
  });

  it("dengan gram awal: stok langsung terisi lewat satu ACQUIRE", async () => {
    const db = await freshDb();

    const lot = await addLotWithInitialStock(db, args, 250);

    expect(await currentStock(db, lot.id)).toBe(250);
    const txns = await history(db, lot.id);
    expect(txns.length).toBe(1);
    expect(txns[0].reason).toBe("ACQUIRE");
    expect(txns[0].grams).toBe(250);
  });

  it("gram awal nol ditolak, tapi lot-nya tetap terbuat", async () => {
    const db = await freshDb();

    await expect(addLotWithInitialStock(db, args, 0)).rejects.toThrow(
      InvalidQuantityError,
    );

    const lots = await listLots(db);
    expect(lots.length).toBe(1);
    expect(await currentStock(db, lots[0].id)).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan MERAH**

Run: `cd web && npx vitest run`
Expected: gagal dengan `addLotWithInitialStock is not defined`. Laporkan pesan sebenarnya.

- [ ] **Step 3: Implementasi**

Tambahkan ke `web/lib/ledger/service.ts`, setelah `addLot`:

```ts
/**
 * Buat lot, dan kalau gram awal diberikan, catat sekalian ACQUIRE-nya.
 *
 * Sengaja tanpa rollback: kalau ACQUIRE gagal setelah lot terbuat, lot tetap
 * ada dengan stok nol. Membuat lot dan mencatat transaksi adalah dua fakta
 * terpisah di buku besar, dan lot berstok nol itu keadaan yang sah.
 *
 * `initialGrams` yang <= 0 ditolak oleh `record()`, bukan diabaikan diam-diam.
 * Form mengirim `undefined` kalau kolomnya dikosongkan.
 */
export async function addLotWithInitialStock(
  db: LedgerDb,
  args: { name: string; origin: string; varietal: string; roastDate: string; notes?: string | null },
  initialGrams?: number,
): Promise<Lot> {
  const lot = await addLot(db, args);
  if (initialGrams !== undefined) {
    await recordAcquire(db, lot.id, initialGrams, "stok awal");
  }
  return lot;
}
```

- [ ] **Step 4: Jalankan, pastikan HIJAU**

Run: `cd web && npx vitest run`
Expected: `20 passed`.

- [ ] **Step 5: Commit**

```bash
git add web/lib/ledger/service.ts web/lib/ledger/ledger.test.ts
git commit -m "feat: addLotWithInitialStock — bikin lot sekalian stok awalnya

Ngisi lot baru tadinya dua langkah di dua halaman. Sengaja tanpa rollback:
lot berstok nol itu keadaan yang sah, dan bikin lot vs catat transaksi itu
dua fakta terpisah di buku besar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 5: Daftar region kopi Indonesia

**Files:**
- Create: `web/lib/regions.ts`

Dipakai dua kali: `<datalist>` di form (mempercepat input), dan peta di Rencana B (koordinatnya). Koordinatnya dimasukkan sekarang karena ia data yang sama, bukan fitur tambahan. Fungsi
pencocokan origin ke region **tidak** dibuat di sini: belum ada yang memakainya sampai
petanya ada, dan kode yang belum dipakai siapa pun adalah kode mati.

- [ ] **Step 1: Buat `web/lib/regions.ts`**

```ts
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
```

- [ ] **Step 2: Cek tipe**

Run: `cd web && npx tsc --noEmit`
Expected: bersih.

- [ ] **Step 3: Commit**

```bash
git add web/lib/regions.ts
git commit -m "feat: daftar region kopi Indonesia + koordinatnya

Dipakai datalist di form tambah lot sekarang, dan peta lot aktif di
Rencana B. Origin tetap teks bebas — daftar ini nawarin, bukan maksa.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 6: Sambungkan ke Server Action dan UI

**Files:**
- Modify: `web/app/(app)/actions.ts`
- Modify: `web/app/(app)/lots/add-lot-form.tsx`
- Create: `web/app/(app)/lots/finish-lot-button.tsx`
- Modify: `web/app/(app)/lots/page.tsx`

**Keamanan:** `await requireSession()` wajib jadi pernyataan pertama di setiap Server Action, termasuk `finishLotAction` yang baru. Server Action adalah endpoint HTTP yang bisa dipanggil langsung; ia tidak mewarisi perlindungan dari halaman yang menampilkan tombolnya.

- [ ] **Step 1: Ubah `addLotAction` menerima gram awal**

Di `web/app/(app)/actions.ts`, ganti impor `addLot` menjadi `addLotWithInitialStock`, dan di dalam `addLotAction` ganti pembacaan form serta pemanggilannya:

```ts
  const initialGramsRaw = String(formData.get("initialGrams") ?? "").trim();
  const initialGrams = initialGramsRaw === "" ? undefined : Number(initialGramsRaw);

  if (initialGrams !== undefined && !Number.isFinite(initialGrams)) {
    return { error: "Gram awal harus berupa angka." };
  }

  try {
    await addLotWithInitialStock(
      db,
      { name, origin, varietal, roastDate, notes: notes || null },
      initialGrams,
    );
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }
```

Tambahkan `revalidatePath("/history")` di samping revalidate yang sudah ada, karena sekarang aksi ini bisa membuat transaksi.

- [ ] **Step 2: Tambahkan `finishLotAction`**

Di file yang sama:

```ts
export async function finishLotAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const lotId = Number(formData.get("lotId"));
  if (!Number.isFinite(lotId) || lotId <= 0) return { error: "Lot gak dikenal." };

  try {
    await finishLot(db, lotId);
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }

  revalidatePath("/lots");
  revalidatePath("/record");
  revalidatePath("/history");
  revalidatePath("/");
  return { success: true };
}
```

Tambahkan `finishLot` ke daftar impor dari `@/lib/ledger/service`.

- [ ] **Step 3: Tambahkan kolom gram awal dan datalist region ke form**

Di `web/app/(app)/lots/add-lot-form.tsx`:

Impor daftarnya di atas: `import { COFFEE_REGIONS } from "@/lib/regions";`

Ganti input origin yang ada menjadi:

```tsx
      <label className="flex flex-col gap-1">
        <span className={labelClass}>Origin</span>
        <input
          name="origin"
          type="text"
          required
          list="coffee-regions"
          className={inputClass}
          placeholder="Kerinci, Jambi"
        />
        <datalist id="coffee-regions">
          {COFFEE_REGIONS.map((r) => (
            <option key={r.name} value={r.name} />
          ))}
        </datalist>
      </label>
```

Tambahkan kolom baru tepat setelah input tanggal roast:

```tsx
      <label className="flex flex-col gap-1">
        <span className={labelClass}>Stok awal, gram (opsional)</span>
        <input
          name="initialGrams"
          type="number"
          step="any"
          min="0"
          className={inputClass}
          placeholder="250"
        />
      </label>
```


- [ ] **Step 4: Buat tombol Habiskan**

Buat `web/app/(app)/lots/finish-lot-button.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { finishLotAction, type ActionState } from "../actions";

const initialActionState: ActionState = {};

export function FinishLotButton({
  lotId,
  lotName,
  grams,
}: {
  lotId: number;
  lotName: string;
  grams: string;
}) {
  const [state, formAction, pending] = useActionState(
    finishLotAction,
    initialActionState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // Penulisan ini gak bisa dibatalkan dengan satu klik lagi, jadi
        // konfirmasinya menyebut jumlah gramnya secara eksplisit.
        if (
          !confirm(
            `Habiskan "${lotName}"? Ini mencatat koreksi keluar ${grams} dan gak bisa dibatalkan otomatis.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="lotId" value={lotId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-line px-3 py-1 font-body text-xs text-ink-dim transition-colors hover:border-clay hover:text-clay disabled:opacity-50"
      >
        {pending ? "..." : "Habiskan"}
      </button>
      {state.error ? (
        <p className="mt-1 font-body text-xs text-clay" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 5: Tampilkan tombolnya di tabel lot**

Di `web/app/(app)/lots/page.tsx`, impor `FinishLotButton` dari `./finish-lot-button`, tambahkan satu `<th>` kosong di akhir baris header:

```tsx
                  <th className="py-2 pl-4" />
```

dan satu `<td>` di akhir tiap baris, yang hanya berisi tombol saat stok masih ada:

```tsx
                    <td className="py-3 pl-4 text-right">
                      {stock > 0 ? (
                        <FinishLotButton
                          lotId={lot.id}
                          lotName={lot.name}
                          grams={formatGrams(stock)}
                        />
                      ) : null}
                    </td>
```

- [ ] **Step 6: Verifikasi menyeluruh**

Run: `cd web && npx next typegen && npx tsc --noEmit && npx vitest run && npx next build`
Expected: tipe bersih, `20 passed`, build sukses.

- [ ] **Step 7: Buktikan `requireSession()` ada di setiap aksi**

Run: `cd web && grep -n -A6 "^export async function.*Action" "app/(app)/actions.ts" | grep -n "requireSession"`
Expected: satu baris per aksi yang diekspor (tiga: addLot, record, finishLot). Tempelkan hasilnya.

Run: `cd web && curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/lots` dengan dev server jalan
Expected: `307 http://localhost:3000/login`.

- [ ] **Step 8: Buktikan alurnya sampai ke database**

Pakai cookie sesi yang ditandatangani sendiri (cara yang sama seperti verifikasi tugas sebelumnya di repo ini):

```js
// jalankan dari dalam web/ supaya next-auth ke-resolve
import { encode } from "next-auth/jwt";
import { config } from "dotenv";
config({ path: "../.env" });
const token = await encode({
  token: { name: "Hilmi", email: process.env.AUTH_ALLOWED_EMAIL, sub: "verify-only" },
  secret: process.env.AUTH_SECRET, salt: "authjs.session-token", maxAge: 900,
});
```

Pasang sebagai cookie `authjs.session-token` di `localhost`, lalu dengan Playwright (`/Users/hilmi/anaconda3/bin/python`, chromium sudah terunduh):

1. Buka `/lots`, tambah lot bernama `verify-lifecycle`, origin dipilih dari datalist (`Kintamani, Bali`), varietal apa saja, **stok awal 100**.
2. Pastikan lot muncul di tabel dengan stok `100 g`, dan dashboard `/` ikut naik 100 g.
3. Klik **Habiskan** pada lot itu (terima dialog konfirmasi lewat `page.on("dialog", d => d.accept())`).
4. Pastikan stoknya jadi `0 g`, tombol Habiskan hilang, dan `/history` memuat dua baris untuk lot itu: `+100` (stok awal) lalu `−100` (habis).

Laporkan angka stok pada tiap langkah. **Lot uji ini dibiarkan** di database dengan stok nol; jangan menghapusnya, karena buku besar ini append-only dan lot berstok nol adalah keadaan yang sah. Sebutkan di laporan bahwa lot `verify-lifecycle` tertinggal.

Ambil screenshot penuh `/lots` (viewport 1180x900, `device_scale_factor=2`) ke `/private/tmp/claude-501/-Users-hilmi-orca-workspaces-Coffee-CoffeeData/57847cab-e2fc-4e67-96e7-08576232b590/scratchpad/lots-lifecycle.png`, **lihat gambarnya**, dan laporkan apa pun yang rusak secara visual. Hapus skrip sementara dan berkas token setelahnya, lalu pastikan `git status` bersih.

- [ ] **Step 9: Commit**

```bash
git add web/
git commit -m "feat: tambah lot sekalian stok awal, dan tombol Habiskan

Ngisi lot baru turun dari dua langkah jadi satu. Tombol Habiskan nyatet
koreksi keluar sebesar sisa stok, bukan ngehapus, dan minta konfirmasi
yang nyebut jumlah gramnya.

Origin dapet datalist region kopi Indonesia: input lebih cepat, penulisan
lebih konsisten, dan koordinatnya kepake buat peta nanti.

requireSession() jadi baris pertama di finishLotAction juga.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

## Definisi selesai

- [ ] `uv run pytest` → `22 passed`
- [ ] `cd web && npx vitest run` → `20 passed`
- [ ] `npx tsc --noEmit` bersih, `npx next build` sukses
- [ ] Tidak ada sisa `fraunces`/`karla`/`plex` di `web/`
- [ ] `app/app.py`, `requirements.txt`, `.streamlit/` sudah tidak ada
- [ ] README menyebut Drizzle sebagai pemilik schema
- [ ] Menambah lot berisi selesai dalam satu langkah, terbukti sampai ke Neon
- [ ] Tombol Habiskan membawa stok ke nol dan menambah baris riwayat, bukan menghapus
- [ ] `requireSession()` adalah pernyataan pertama di ketiga Server Action

Setelah semua tercentang, Rencana B (isi dashboard, keadaan kosong, peta) bisa ditulis.
