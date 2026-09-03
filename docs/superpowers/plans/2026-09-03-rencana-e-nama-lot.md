# Rencana E — Nama Lot Tersusun dari Bagiannya

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Nama lot berhenti diketik ulang dari informasi yang sudah ada di kolom lain, dan tersusun sendiri dari Origin, Proses, dan satu kata khusus opsional.

**Architecture:** Satu fungsi murni di `lib/format.ts` yang dites lewat Vitest, lalu dipakai form untuk mengisi kolom Nama secara langsung. Tidak ada perubahan schema, tidak ada kolom baru di database.

**Tech Stack:** Next.js 16.3.4, React 19, Vitest.

---

## Keputusan yang sudah diambil

| Hal | Keputusan | Alasan |
|---|---|---|
| Urutan | `{Origin} {kata khusus?} {Proses}` | Pola pemilik projek. Situs acuan (Tanjoe) justru menaruh proses di depan; polanya sendiri yang dipakai |
| Kolom Nama | **Terisi otomatis, tetap bisa diedit** | Luwes untuk kasus yang tidak mengikuti pola |
| Kata khusus | Kolom form saja, **tidak disimpan di database** | Ia cuma bahan penyusun; hasilnya sudah tertangkap di `name` |
| Bentuk pendek origin | Diturunkan, bukan disimpan | `"Gayo, Aceh"` → `"Gayo"` cukup dengan memotong di koma pertama. Jalan juga untuk origin ketikan bebas |
| Lot lama | Dihapus atas permintaan pemilik projek | Lot `Gayo Wine Natural` itu data verifikasi, bukan kopi sungguhan. Database dikosongkan sebelum rencana ini dikerjakan |

**Tidak ada migrasi.** Kolom `name` sudah ada dan tetap menyimpan hasil susunannya.

## Contoh yang harus dihasilkan

```
Gayo, Aceh              + Wine                            → Gayo Wine
Kerinci, Jambi          + Natural Anaerob                 → Kerinci Natural Anaerob
Toraja, Sulawesi Selatan+ Washed                          → Toraja Washed
Gayo, Aceh + "Single Var Typica" + Darkroom Natural Anaerob 48H
                                                          → Gayo Single Var Typica Darkroom Natural Anaerob 48H
```

## Struktur file

| File | Perubahan | Tanggung jawab |
|---|---|---|
| `web/lib/format.ts` | Modify | `composeLotName` |
| `web/lib/ledger/ledger.test.ts` | Modify | 4 test baru (34 → 38) |
| `web/app/(app)/rak/add-lot-form.tsx` | Modify | Kolom kata khusus + pengisian otomatis |

---

### Task 1: `composeLotName` (TDD)

**Files:**
- Modify: `web/lib/format.ts`
- Modify: `web/lib/ledger/ledger.test.ts`

- [x] **Step 1: Tulis test yang gagal**

Tambahkan `describe` baru di `web/lib/ledger/ledger.test.ts`, impor `composeLotName` dari `"../format"` di samping `daysSince` yang sudah diimpor dari sana:

```ts
describe("composeLotName", () => {
  it("menggabungkan bentuk pendek origin dengan proses", () => {
    expect(composeLotName("Gayo, Aceh", "Wine")).toBe("Gayo Wine");
    expect(composeLotName("Kerinci, Jambi", "Natural Anaerob")).toBe(
      "Kerinci Natural Anaerob",
    );
  });

  it("menyelipkan kata khusus di antara origin dan proses", () => {
    expect(
      composeLotName("Gayo, Aceh", "Darkroom Natural Anaerob 48H", "Single Var Typica"),
    ).toBe("Gayo Single Var Typica Darkroom Natural Anaerob 48H");
  });

  it("origin tanpa koma dipakai apa adanya", () => {
    expect(composeLotName("Toraja", "Washed")).toBe("Toraja Washed");
  });

  it("bagian kosong dilewati dan spasi berlebih dirapikan", () => {
    expect(composeLotName("  Gayo, Aceh  ", "  Wine  ", "   ")).toBe("Gayo Wine");
    expect(composeLotName("", "Washed")).toBe("Washed");
    expect(composeLotName("Gayo, Aceh", "")).toBe("Gayo");
  });
});
```

Test terakhir penting: form menyusun nama **sambil kamu mengetik**, jadi fungsinya harus menangani keadaan setengah terisi tanpa melempar error atau meninggalkan spasi ganda.

- [x] **Step 2: Jalankan, pastikan MERAH**

Run: `cd web && npx vitest run`
Expected: gagal dengan `composeLotName is not a function`. Laporkan pesan sebenarnya.

- [x] **Step 3: Implementasi**

Tambahkan ke `web/lib/format.ts`:

```ts
/**
 * Susun nama lot dari bagian-bagiannya: {origin pendek} {kata khusus} {proses}.
 *
 * Nama lot selama ini mengulang informasi yang sudah ada di kolom lain, dan
 * dua salinan informasi yang sama pada akhirnya akan berbeda. Menyusunnya
 * membuat nama jadi turunan, bukan hal terpisah yang harus dijaga.
 *
 * Bentuk pendek origin diambil dengan memotong di koma pertama, jadi
 * "Gayo, Aceh" jadi "Gayo". Ini juga jalan untuk origin ketikan bebas yang
 * tidak ada di daftar region.
 *
 * Semua bagian boleh kosong: form memanggil ini sambil pengguna mengetik,
 * jadi keadaan setengah terisi itu normal, bukan kesalahan.
 */
export function composeLotName(
  origin: string,
  processMethod: string,
  special?: string,
): string {
  const originShort = (origin.split(",")[0] ?? "").trim();
  return [originShort, (special ?? "").trim(), processMethod.trim()]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [x] **Step 4: Jalankan, pastikan HIJAU**

Run: `cd web && npx vitest run`
Expected: `38 passed`.

- [x] **Step 5: Commit**

```bash
git add web/lib/format.ts web/lib/ledger/ledger.test.ts
git commit -m "feat: composeLotName — nama lot disusun dari bagiannya

Nama lot selama ini ngulang info yang udah ada di kolom lain, dan dua
salinan info yang sama lama-lama bakal beda. Sekarang nama jadi turunan.

Bentuk pendek origin dipotong di koma pertama, jadi jalan juga buat origin
ketikan bebas yang gak ada di daftar region.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 2: Kolom kata khusus dan pengisian otomatis

**Files:**
- Modify: `web/app/(app)/rak/add-lot-form.tsx`

Form tambah lot ada di dalam `<details>` pada halaman Rak. Ia sudah client component dan memakai `useActionState`.

- [x] **Step 1: Susun ulang urutan kolomnya**

Urutan baru, dan alasannya sebab mendahului akibat: kolom yang menyusun nama diletakkan lebih dulu, kolom Nama menyusul sebagai hasilnya.

```
Origin  ·  Varietal  ·  Proses pasca panen  ·  Kata khusus (opsional)
Nama lot  ·  Tanggal roast  ·  Stok awal (opsional)  ·  Catatan (opsional)
```

Kolom Kata khusus baru:

```tsx
      <label className="flex flex-col gap-1">
        <span className={labelClass}>Kata khusus (opsional)</span>
        <input
          name="special"
          type="text"
          className={inputClass}
          placeholder="Single Var Typica"
        />
      </label>
```

`name="special"` **tidak dibaca Server Action** dan tidak disimpan. Ia cuma bahan penyusun; hasilnya sudah ada di `name`.

- [x] **Step 2: Isi kolom Nama secara otomatis**

Simpan nilai ketiga kolom penyusun di state, dan turunkan nilai Nama darinya. Kolom Nama tetap `<input>` biasa yang bisa diedit.

**Kuncinya penjejakan "sudah disentuh".** Begitu pengguna mengetik di kolom Nama, pengisian otomatis berhenti selamanya untuk pengisian form itu. Tanpa ini, mengubah Proses setelah menulis nama kustom akan menghapus ketikannya tepat setelah ia menulisnya, dan itu terasa seperti aplikasinya melawan.

```tsx
const [origin, setOrigin] = useState("");
const [processMethod, setProcessMethod] = useState("");
const [special, setSpecial] = useState("");
const [name, setName] = useState("");
const [nameTouched, setNameTouched] = useState(false);

const composed = composeLotName(origin, processMethod, special);
const nameValue = nameTouched ? name : composed;
```

Kolom Nama memakai `value={nameValue}`, dan `onChange` menyetel `setName(e.target.value)` **dan** `setNameTouched(true)`.

Setelah submit berhasil (`state.success`, di `useEffect` yang sudah ada dan memanggil `formRef.current?.reset()`), kembalikan semuanya ke kosong termasuk `setNameTouched(false)` — kalau tidak, lot kedua yang kamu tambahkan tidak akan terisi otomatis.

Beri kolom Nama satu baris bantuan kecil `text-ink-faint`: `Terisi otomatis dari Origin, Kata khusus, dan Proses. Boleh diubah.`

- [x] **Step 3: Verifikasi mekanis**

Run: `cd web && npx next typegen && npx tsc --noEmit && npx vitest run && npx next build`
Expected: bersih, `38 passed`, build sukses.

- [x] **Step 4: Buktikan perilakunya di browser**

Cetak cookie sesi seperti tugas sebelumnya di repo ini (`encode` dari `next-auth/jwt`, salt `authjs.session-token`, rahasia dari `../.env`), lalu dengan Playwright (`/Users/hilmi/anaconda3/bin/python`, viewport 1180x900, `device_scale_factor=2`).

Database **kosong** saat ini. Buka `/rak` dan buka `<details>` "Tambah lot baru", lalu buktikan empat hal, laporkan nilai kolom Nama di tiap langkah:

1. **Menyusun.** Pilih Origin `Gayo, Aceh`, isi Proses `Wine`. Kolom Nama harus berbunyi `Gayo Wine`.
2. **Menyelipkan kata khusus.** Isi Kata khusus `Single Var Typica`, ubah Proses jadi `Darkroom Natural Anaerob 48H`. Nama harus jadi `Gayo Single Var Typica Darkroom Natural Anaerob 48H`.
3. **Mundur setelah disentuh.** Ketik manual di kolom Nama, ganti jadi `Percobaan Manual`. Lalu ubah Proses jadi `Washed`. Nama **harus tetap** `Percobaan Manual`, tidak tertimpa. Ini pemeriksaan terpenting; kalau tertimpa, penjejakannya salah.
4. **Tersimpan apa adanya.** Kosongkan lagi kolom-kolomnya lewat reload, lalu tambah lot sungguhan: Origin `Toraja, Sulawesi Selatan`, Varietal `Typica`, Proses `Washed`, tanggal roast hari ini, stok awal `250`. Nama harus terisi `Toraja Washed`. Kirim, lalu pastikan baris di Rak berbunyi `Toraja Washed` dengan `250 g`.

**Tinggalkan lot `Toraja Washed` itu di database.** Ini data awal sungguhan, dan pemilik projek akan menggantinya sendiri kalau bukan kopi yang dia punya.

Ambil screenshot form yang terisi (langkah 2, sebelum dikirim) dan halaman Rak setelahnya ke `.../scratchpad/form-nama.png` dan `.../scratchpad/rak-nama.png`. **Lihat keduanya** dan laporkan apa pun yang rusak.

Halaman punya beberapa tombol submit termasuk logout di header; batasi selectormu atau kamu akan keluar dari sesi alih-alih menyimpan.

- [x] **Step 5: Bersihkan dan commit**

Hapus skrip sementara dan berkas token; `git status` harus bersih.

```bash
git add web/
git commit -m "feat: kolom kata khusus, nama lot keisi otomatis

Nama keisi dari Origin + Kata khusus + Proses, tapi tetep bisa diedit.
Begitu kolom Nama disentuh, otomatisnya mundur — kalau enggak, ngubah
Proses abis nulis nama kustom bakal ngapus ketikan yang barusan ditulis.

Kata khusus cuma kolom form, gak disimpen: hasilnya udah ketangkep di name.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

## Definisi selesai

- [x] `cd web && npx vitest run` → `38 passed`
- [x] `uv run pytest` → `22 passed` (tidak tersentuh)
- [x] `npx tsc --noEmit` bersih, `npx next build` sukses
- [x] Nama terisi sendiri dari Origin, Kata khusus, dan Proses
- [x] Setelah kolom Nama diketik manual, mengubah Proses **tidak** menimpanya
- [x] Setelah submit berhasil, form kembali kosong dan pengisian otomatis hidup lagi
- [x] Tidak ada perubahan schema; `special` tidak pernah masuk database
