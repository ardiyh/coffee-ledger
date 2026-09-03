# Edit lot — ganti "Habiskan" jadi "Edit" di Rak

**Tanggal:** 2026-09-03
**Status:** Disetujui, siap masuk rencana implementasi

## 1. Konteks

Di `/rak`, tiap baris lot (`lot-row.tsx`) punya tombol **"Habiskan"** (`finish-lot-button.tsx`,
muncul cuma saat stok > 0) yang mencatat satu `ADJUST OUT` sebesar sisa stok lewat
`finishLotAction`.

Yang belum ada sama sekali: cara mengubah **data deskriptif** sebuah lot yang sudah
tersimpan (`name`, `origin`, `varietal`, `processMethod`, `roastDate`, `notes`). Kalau ada
salah ketik saat menambah lot — misal varietal atau proses pasca panen salah pilih — satu-
satunya cara memperbaikinya sekarang adalah langsung ke database. Ini yang memicu spec ini.

Keputusan: tombol "Habiskan" **diganti** tombol **"Edit"** yang membuka form inline untuk
mengubah field-field itu. Fungsi "habiskan sekali klik" dihapus, bukan dipindah — sudah bisa
dicapai manual lewat aksi "Koreksi turun" yang sudah ada di form transaksi tiap baris (isi
gram = sisa stok). Satu jalur untuk mengubah stok (form transaksi) lebih konsisten daripada
dua tombol yang sama-sama menyentuh angka gram dengan cara berbeda.

## 2. Lingkup

**Termasuk:** edit `name`, `origin`, `varietal`, `processMethod`, `roastDate`, `notes` pada
lot yang sudah ada.

**Tidak termasuk:** apa pun yang menyentuh gram/stok. Stok tetap murni hasil hitung dari
transaksi (§ prinsip ledger di README) — edit tidak pernah menulis ke tabel `transaction`
maupun mengoreksi angka stok secara langsung. Ini bukan pembatasan sewenang-wenang: mencampur
"ubah data lot" dengan "catat pergerakan stok" dalam satu form akan mengaburkan dua fakta yang
selama ini sengaja dipisah di seluruh app.

**Kata khusus tidak ikut ter-edit sebagai konsep terpisah.** Form Tambah lot punya field
"Kata khusus" yang dipakai `composeLotName()` (`web/lib/format.ts`) untuk menyusun `name`
otomatis dari origin + kata khusus + proses. Nilai "kata khusus" itu sendiri **tidak
disimpan** sebagai kolom — begitu lot tersimpan, yang ada cuma `name` hasil akhirnya. Karena
itu, di form Edit, `name` diperlakukan sebagai **teks bebas biasa** tanpa logic penyusunan
otomatis, sama seperti mode "sudah diketik manual" (`nameTouched`) yang sudah ada di form
Tambah lot.

## 3. Data & service layer

### `web/lib/ledger/repository.ts`

Fungsi baru:

```ts
export async function updateLot(
  db: LedgerDb,
  lotId: number,
  fields: NewLot,
): Promise<Lot | null>
```

Satu `UPDATE lot SET ... WHERE id = ... RETURNING *`. `NewLot` (interface yang sudah ada)
dipakai apa adanya — bentuknya sudah persis field yang bisa diedit. Balikin `null` kalau
`lotId` gak ketemu (`RETURNING` kosong), bukan lempar error — pola yang sama seperti
`getLot()`.

### `web/lib/ledger/service.ts`

```ts
export async function updateLot(
  db: LedgerDb,
  lotId: number,
  args: NewLotArgs,
): Promise<Lot>
```

Panggil `repo.updateLot`; kalau hasilnya `null`, lempar `LotNotFoundError` — pola yang sama
seperti `_record()` dan `finishLot()` yang sudah ada. `NewLotArgs` (interface yang sudah
dipakai `addLot`) dipakai ulang, jadi tidak ada tipe baru.

### `web/app/(app)/actions.ts`

Server action baru `editLotAction`, sejajar `addLotAction`:

1. `requireSession()` — gerbang auth yang sama di setiap Server Action.
2. Ambil & `trim()` `lotId`, `name`, `origin`, `varietal`, `processMethod`, `roastDate`,
   `notes` dari `FormData`.
3. Validasi wajib: `name`, `origin`, `varietal`, `processMethod`, `roastDate` — pesan error
   sama persis seperti `addLotAction`. `notes` opsional.
4. `try { await updateLot(db, lotId, {...}) } catch (err) { if (err instanceof LedgerError) return { error: err.message }; throw err; }`
5. `revalidatePath("/rak")`, `revalidatePath("/history")`, `revalidatePath("/dashboard")` —
   nama & origin lot tampil di ketiga halaman itu (riwayat transaksi menampilkan nama lot,
   dashboard menampilkan nama di stock bars & peta origin).
6. Return `{ success: true }`.

`finishLotAction` dan importnya (`finishLot` dari `service.ts`) dihapus dari `actions.ts`.
`finishLot()` di `service.ts` sendiri **dibiarkan ada** — dia cuma pembungkus tipis di atas
`recordAdjust()` yang tetap valid sebagai fungsi service, cuma sudah tidak dipanggil dari UI
manapun. (Kalau linter/`ruff`-equivalent di TS menandainya sebagai unused export, itu
ditangani saat implementasi, bukan dihapus preventif di sini.)

## 4. UI

- `web/app/(app)/rak/finish-lot-button.tsx` dihapus.
- File baru `web/app/(app)/rak/edit-lot-form.tsx` — client component, pola sama seperti
  `AddLotForm`: `useActionState(editLotAction, ...)`, field terkontrol untuk tiap kolom,
  submit lewat action-wrapper (bukan `useEffect`) untuk kembali ke mode-lihat setelah sukses
  — pola yang sama dengan perbaikan yang baru dilakukan di `add-lot-form.tsx`.
- `lot-row.tsx` dapat state lokal `editing: boolean` (default `false`). Tombol **"Edit"**
  (selalu tampil, tidak lagi bersyarat `stock > 0`) meng-toggle `editing`.
  - `editing === false`: tampilan baris seperti sekarang (nama, origin · varietal · proses ·
    umur roast, angka stok, tombol Edit).
  - `editing === true`: bagian header baris diganti `<EditLotForm>` terisi nilai lot
    sekarang, dengan tombol **Simpan** dan **Batal**. **Batal** cukup `setEditing(false)` —
    tidak ada network call, perubahan lokal dibuang.
  - Form transaksi (Aksi/Gram/Catatan) di bagian bawah baris **tidak terpengaruh** — tetap
    tampil apa adanya baik `editing` true maupun false.
- Datalist saran (`suggestions.origins/varietals/processMethods`) yang sekarang cuma
  di-pass ke `AddLotForm` di `rak/page.tsx` di-thread juga ke tiap `LotRow` → `EditLotForm`,
  supaya field edit dapat saran autocomplete yang sama.

## 5. Error handling & validasi

Sama persis pola `addLotAction`/`recordAction`: `LedgerError` → `{ error: msg }` dirender di
form (`role="alert"`, kelas `text-clay`), error lain (bug) dilempar ulang (tidak ditelan).

Satu-satunya error domain yang realistis dari jalur ini adalah `LotNotFoundError` — edge case
kalau lot hilang di antara render dan submit. Tidak ada fitur hapus lot di app ini, jadi
kasusnya cuma teoretis, tapi ditangani karena polanya konsisten dengan Server Action lain.

Tidak ada dialog konfirmasi untuk Simpan (beda dengan "Habiskan" yang lama) — mengubah data
deskriptif tidak menyentuh buku besar transaksi dan sepenuhnya bisa diedit ulang kalau salah,
jadi tidak butuh gerbang "tidak bisa dibatalkan otomatis" seperti stok.

## 6. Testing

Ditambah ke `web/lib/ledger/ledger.test.ts`, sejajar test `service.*` yang sudah ada:

- Edit lot yang ada → field baru ke-persist, ke-baca lagi lewat `listLots`/`getLot`.
- Edit lot dengan `lotId` yang gak ada → lempar `LotNotFoundError`.

Tidak ada test komponen React ditambahkan — konsisten dengan cakupan test yang sudah ada
sekarang, yang berhenti di layer service/repository, bukan UI.

## 7. Bukan bagian dari pekerjaan ini

- Mengubah stok/gram lewat Edit — tetap murni lewat form transaksi.
- Menghapus lot.
- Dialog/modal — dipilih inline expand, konsisten dengan pola `<details>` yang sudah ada di
  halaman ini.
- Menyimpan ulang "kata khusus" sebagai kolom terpisah supaya nama bisa di-recompose saat
  edit — di luar lingkup, dan tidak diminta.
- Riwayat perubahan (audit log) untuk edit field lot — kalau `name`/`origin` diubah, baris
  riwayat transaksi lama tetap menampilkan nama lot yang **sekarang** (join by `lot_id`,
  bukan snapshot), sama seperti perilaku saat ini untuk field lot apa pun. Tidak diminta dan
  tidak diubah di sini.

## 8. Risiko & hal terbuka

- **`finishLot()` di `service.ts` jadi dead code dari sisi UI** setelah `finishLotAction`
  dihapus. Dipertahankan karena bukan tabu untuk fungsi service murni tanpa pemanggil UI, dan
  menghapusnya bukan bagian dari permintaan ini — dicatat di sini supaya sadar, bukan
  dibiarkan diam-diam.
