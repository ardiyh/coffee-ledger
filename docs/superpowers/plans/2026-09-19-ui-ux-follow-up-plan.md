# Coffee Ledger UI/UX Follow-up Implementation Plan

**Status pelaksanaan 20 September 2026:** implementasi dan verifikasi lokal
dituntaskan; hasil aktual beserta batas pengujian ada di
[laporan rilis](../../ui-ux-release-2026-09-20.md). Checklist di bawah dipertahankan
sebagai instruksi rencana asli, bukan pengganti laporan verifikasi/deployment.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Jalankan berurutan dengan review per task; jangan mengubah pekerjaan lain yang sudah ada di worktree.

**Goal:** Mempercepat pencatatan dan penelusuran kopi, memperjelas informasi Dashboard, dan memperbaiki aksesibilitas tanpa mengubah aturan ledger.

**Architecture:** Pertahankan Server Components untuk autentikasi dan pengambilan data. Tambahkan client components kecil hanya untuk pencarian, filter, disclosure, dan feedback. Gunakan Server Actions dan perhitungan stok Postgres yang sudah ada; tidak ada migrasi database atau penggantian library UI.

**Tech Stack:** Next.js 16.3.4, React 19, TypeScript, Tailwind v4, Drizzle/Neon, Vitest, Testing Library, PGlite, react-simple-maps.

---

## Baseline dan batas scope

Rencana disusun pada 19 September 2026, HEAD lokal `5c1c774`. Ini **bukan** bukti versi production. Cek ulang HEAD sebelum eksekusi karena repo sedang aktif berubah.

- Peta dunia, pencocokan negara/provinsi, pengurutan grafik, filter proses, dan filter profil roast **sudah ada**. Jangan membangun ulang fitur tersebut.
- Rujukan peta: `docs/superpowers/plans/2026-09-19-origin-map-world-plan.md`. Lanjutkan pengujian visual yang belum dicentang, bukan menyalin ulang implementasinya.
- Penyempurnaan Dashboard desktop, wrap teks Riwayat, screenshot landing, dan copy warna masih berupa perubahan lokal. Review dan pertahankan, jangan dianggap pekerjaan baru.
- Angka “6 dari 11 lot terpetakan” dari audit lama adalah reproduksi keterbatasan peta lama, **bukan target untuk peta dunia terbaru**. Gunakan fixture untuk pengujian, bukan jumlah produksi yang berubah.
- Pertahankan Geist, warna gelap hangat, amber sebagai aksen, tanda +/− transaksi, angka tabular, dan navigasi atas.
- Tidak membuat undo/delete transaksi, geocoding eksternal, ambang kualitas roast, akun baru, atau kolom penerima baru.
- Tidak mengubah data nyata untuk tes. Semua tes mutasi memakai mock atau database terisolasi.
- Commit, push, migrasi, dan deploy tidak dilakukan oleh penyusunan rencana ini. Rilis production perlu instruksi terpisah.

## Urutan dan dependensi

1. Task 0: baseline dan pengamanan perubahan lokal.
2. Task 1: kejelasan cakupan peta.
3. Task 2: pencarian Rak dan form terfokus.
4. Task 3: feedback transaksi serta label penerima; bergantung Task 2.
5. Task 4: filter Riwayat.
6. Task 5: hubungan Dashboard → Rak, copy, dan kontrol filter; bergantung Task 2.
7. Task 6: aksesibilitas, login, dan ketahanan landing.
8. Task 7: verifikasi terpadu dan persiapan rilis.

Task 1, 4, dan 6 bisa dirilis sebagai perubahan kecil yang berdiri sendiri. Jangan menggabungkan semuanya dalam satu perubahan besar.

## Peta file dan tanggung jawab

| Area | File | Tanggung jawab |
|---|---|---|
| Peta | `web/app/(app)/_dashboard/origin-map.tsx` | Cakupan, fallback bernama, kontrol zoom/reset |
| Rak server | `web/app/(app)/rak/page.tsx` | Session, fetch data, form tambah lot |
| Rak client baru | `web/app/(app)/rak/lot-list.tsx` | Cari/urut/status, lot yang terbuka, feedback stabil |
| Baris lot | `web/app/(app)/rak/lot-row.tsx` | Disclosure, transaksi, edit; pertahankan roastProfile |
| Actions | `web/app/(app)/actions.ts` | Mengembalikan receipt transaksi yang benar-benar tersimpan |
| Riwayat | `web/app/(app)/history/page.tsx`, `history-list.tsx` baru | Server fetch dan client filtering/rendering |
| Dashboard | `web/app/(app)/_dashboard/stock-bars.tsx`, `outflow.tsx`, `recipients.tsx` | Link lot, copy, filter aksesibel |
| Shell | `web/app/(app)/layout.tsx`, `web/app/layout.tsx` | Skip-link dan judul halaman |
| Login | `web/app/login/credentials-form.tsx`, `page.tsx` | Email bertahan, toggle password, landmark |
| Landing | `web/app/_landing/reveal.tsx`, `web/app/globals.css` | Konten terlihat walau JS gagal |

Tidak memindahkan repository/service atau membuat design-system baru.

## Task 0 — Kunci baseline yang akan dikerjakan

- [ ] Jalankan `git status --short`, `git log -5 --oneline`, dan `git diff --stat`. Catat HEAD serta file yang sudah berubah sebelum mulai.
- [ ] Baca `web/AGENTS.md` dan dokumentasi lokal Next sebelum menulis implementasi: `web/node_modules/next/dist/docs/01-app/02-guides/forms.md`, `web/node_modules/next/dist/docs/03-architecture/accessibility.md`, serta `web/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`.
- [ ] Dari `web/`, jalankan `npm test`, `npm run lint`, dan `npm run typecheck`. Catat jumlah tes aktual; jangan memakai angka 70 dari audit lama sebagai baseline baru.
- [ ] Review diff UI yang sudah ada. Pastikan screenshot masih sesuai aplikasi terbaru: screenshot dua lot sebelum fitur peta dunia/filter dapat kembali usang. Perbarui aset hanya setelah Task 7 stabil.
- [ ] Pisahkan status dokumentasi menjadi `implemented locally`, `verified locally`, `deployed`, dan `verified in production`. Setiap status deployment wajib punya SHA dan bukti deployment, bukan sekadar build sukses.

**Selesai jika:** baseline tercatat, kegagalan lama dibedakan dari regresi baru, dan tidak ada perubahan pengguna yang ditimpa.

## Task 1 — Peta lengkap secara informasi, bukan hanya visual

**Modify:** `web/app/(app)/_dashboard/origin-map.tsx`.
**Create test:** `web/app/(app)/_dashboard/origin-map.test.tsx`.

- [ ] Buat tes komponen dengan mock renderer peta dan data negara/provinsi kecil. Fixture: Aceh 100 g, Jawa Barat 50 g, El Salvador 40 g, origin tak dikenal 25 g. Harus muncul `3 dari 4 lot terpetakan`, nama origin tak dikenal, dan 25 g. Tambahkan kasus semua cocok, semua tidak cocok, dan input kosong; jangan menguji jumlah path dari world-atlas.
- [ ] Jalankan `npm test -- 'app/(app)/_dashboard/origin-map.test.tsx'`; tes cakupan/fallback harus gagal sebelum implementasi.
- [ ] Petakan sekali, lalu gunakan hasil yang sama untuk marker, daftar, dan cakupan:

```tsx
const matched = lots.map((lot) => ({
  ...lot,
  place: matchOrigin(lot.origin, WORLD_COUNTRIES, INDONESIA_PROVINCES),
}));
const placed = matched.filter((lot) => lot.place !== undefined);
const unplaced = matched.filter((lot) => lot.place === undefined);
```

  Sesuaikan tipe grouping lama dengan narrowing hasil ini. Tampilkan daftar fallback per lot berisi nama, origin asli, dan `formatGrams(stock)`. Jangan mengarang koordinat atau mengganti origin tersimpan.
- [ ] Tambahkan copy `Lokasi perkiraan tingkat provinsi atau negara, bukan lokasi kebun.` serta cakupan di atas peta. Input kosong memakai `Belum ada lot aktif`, bukan angka pembagian kosong.
- [ ] Tambahkan tombol `Perbesar`, `Perkecil`, `Reset peta` di luar SVG. Gunakan state view `{ center: [number, number], zoom: number }`, sinkronkan `onMoveEnd`, batasi zoom 1–20. Reset memakai `computeInitialView` dari data terbaru. Jangan mereset pan setiap render.
- [ ] Pertahankan proteksi wheel yang sudah ada. Beri petunjuk Ctrl/⌘ + scroll; cek swipe vertikal di ponsel tidak membuat halaman sulit digulir. Semua informasi tetap terbaca tanpa interaksi peta.
- [ ] Ulangi tes. Uji browser: Indonesia saja, Indonesia + El Salvador, origin tidak dikenal, zoom lalu reset, keyboard pada ketiga tombol, dan mobile 320/390 px.

**Selesai jika:** setiap lot aktif tercakup di daftar terpetakan atau daftar belum terpetakan; jumlah dan total gram tidak hilang; reset mengembalikan semua marker ke framing awal.

## Task 2 — Rak bisa dicari dan tidak membuka semua form

**Modify:** `web/app/(app)/rak/page.tsx`, `lot-row.tsx`, `forms.test.tsx`.
**Create:** `web/app/(app)/rak/lot-list.tsx`, `lot-list.test.tsx`.

Keputusan UX: satu form transaksi/edit terlihat pada satu waktu. Draft tiap lot tetap tersimpan saat beralih; membuka lot lain tidak boleh menghapus input yang belum disimpan.

- [ ] Buat tes dengan tiga lot, termasuk dua bernama sama tetapi ID berbeda. Cari nama/origin tanpa membedakan kapital; pilih status Aktif/Habis/Semua; ubah urutan Nama/Stok/Hari sejak roast; buka lot kedua setelah mengetik draft pada lot pertama lalu kembali. Draft pertama harus utuh.
- [ ] Jalankan `npm test -- 'app/(app)/rak/lot-list.test.tsx'` dan konfirmasi fitur baru belum tersedia.
- [ ] Pindahkan pengelolaan daftar dari server page ke `LotList`, tetapi pertahankan `requireSession`, fetch, suggestions, dan AddLotForm di server page. Kirim data tampilan serializable; jangan mengimpor `db` dari client.
- [ ] State minimal di LotList:

```tsx
const [query, setQuery] = useState("");
const [status, setStatus] = useState<"active" | "empty" | "all">("active");
const [sort, setSort] = useState<"name" | "stock" | "age">("name");
const [openLotId, setOpenLotId] = useState<number | null>(null);
```

  Nama A–Z menjadi default yang tidak bergeser karena transaksi. Stok menurun dan umur roast terlama adalah opsi eksplisit. Tie-break selalu ID. Pencarian memakai `trim().toLocaleLowerCase("id-ID")` terhadap nama dan origin. Tidak perlu fuzzy-search atau library baru.
- [ ] Render semua LotRow dalam satu parent dengan `key={lot.id}`; sembunyikan hasil yang tidak cocok memakai `hidden`, bukan meng-unmount draft. Gunakan form panel `hidden` ketika tertutup. Status Aktif/Habis/Semua menggantikan pemindahan komponen antar dua kelompok sehingga identitas komponen tetap stabil.
- [ ] Tambahkan tombol buka/tutup berlabel `Catat untuk [nama lot]`, `aria-expanded`, `aria-controls`, panel ber-ID `lot-form-[id]`. Pertahankan nama/gram sebagai informasi utama; metadata sekunder boleh membungkus.
- [ ] Selama request pending, cegah penutupan panel dan perubahan filter yang menyembunyikan request tersebut. Saat lot menjadi habis, tahan lot yang sedang terbuka sampai ditutup pengguna; jelaskan bahwa stok sudah habis.
- [ ] Tampilkan jumlah hasil dan `Tidak ada lot yang cocok` dengan tombol `Hapus pencarian`. Jangan menyamakan hasil filter kosong dengan rak yang benar-benar kosong. Form Tambah lot selalu tetap bisa diakses.
- [ ] Ulangi tes Rak lama dengan langkah membuka panel terlebih dahulu. Verifikasi tidak ada regresi edit, batal, roastProfile, dan isian ketika gagal.

**Selesai jika:** lot dapat ditemukan lewat nama/origin, hanya satu panel terbuka, draft bertahan, status kosong jelas, dan transaksi pending tidak kehilangan konteks.

## Task 3 — Receipt transaksi dan penerima yang jelas

**Modify:** `web/app/(app)/actions.ts`, `rak/lot-row.tsx`, `rak/lot-list.tsx`, `rak/forms.test.tsx`.
**Create test:** `web/app/(app)/actions.test.ts` dengan mock session/service/database boundary.

- [ ] Tambahkan tes: error tidak menghasilkan receipt; success membawa ID transaksi, lotId, kind, reason, dan gram dari hasil service; klik ganda saat pending tidak mengirim dua request. Tes komponen: feedback tetap terlihat setelah stok berubah menjadi nol dan panel ditutup.
- [ ] Jalankan `npm test -- 'app/(app)/actions.test.ts' 'app/(app)/rak/forms.test.tsx'`; konfirmasi tes receipt gagal.
- [ ] Perluas ActionState tanpa merusak add/edit:

```ts
export interface TransactionReceipt {
  id: number;
  lotId: number;
  kind: "IN" | "OUT";
  reason: "ACQUIRE" | "BREW" | "GIFT" | "ADJUST";
  grams: number;
}
export interface ActionState {
  error?: string;
  success?: boolean;
  receipt?: TransactionReceipt;
}
```

  Pada recordAction, simpan return value service yang sudah ada, lalu kembalikan field receipt tersebut setelah sukses. Jangan menghitung stok menggunakan pengurangan JS di client. Jangan menambah query sesudah commit yang dapat membuat transaksi sukses dilaporkan gagal hanya karena pembacaan tambahan gagal.
- [ ] Tambahkan callback `onRecorded(receipt: TransactionReceipt): void` pada LotRow. LotList menyimpan receipt terakhir dan nama lot, lalu menampilkan satu `role="status"` stabil di atas daftar: `Seduh 18 g · Toraja Washed tercatat.` serta tautan `/history?lot=ID`. Tidak ada toast yang hilang otomatis sebelum terbaca.
- [ ] Tampilkan `Stok saat ini` dari props hasil refresh, bukan mengklaim saldo historis atomik receipt. Hanya setelah data refresh tersedia label boleh menampilkan nilainya; saat menunggu, gunakan `Memperbarui stok…`. Request gagal mempertahankan semua isian dan menampilkan error inline.
- [ ] Pada pilihan GIFT, gunakan `Penerima (opsional)` dan helper `Isi nama penerima saja; dipakai untuk ringkasan hadiah.` Field tetap `name="note"`. Aksi lain tetap memakai `Catatan (opsional)`. Jangan mengubah data historis atau menggabungkan penerima secara otomatis.
- [ ] Di `web/app/(app)/_dashboard/recipients.tsx`, jelaskan `Dikelompokkan dari catatan transaksi hadiah`. Untuk penerima lebih dari delapan, sediakan disclosure `Lihat semua penerima`, bukan angka sisa tanpa akses detail. Tambahkan tes buka/tutup dan data kosong.
- [ ] Ulangi tes, termasuk dua success berturut-turut dengan ID berbeda, kegagalan lalu retry, GIFT tanpa penerima, dan reset field hanya setelah success.

**Selesai jika:** pengguna tahu apa yang tersimpan dan pada lot mana; saldo tetap berasal dari ledger; feedback tidak ikut hilang ketika baris pindah status.

## Task 4 — Riwayat dapat ditelusuri

**Modify:** `web/app/(app)/history/page.tsx`.
**Create:** `web/app/(app)/history/history-list.tsx`, `history-list.test.tsx`.

Scope awal: gunakan dataset yang memang sudah dimuat halaman, tanpa query backend baru. Ini memperbaiki pencarian, **bukan** klaim optimasi database. Server pagination adalah pekerjaan terpisah jika volume data membutuhkan.

- [ ] Tulis tes filter lot, alasan, rentang tanggal, reset, hasil kosong, dua transaksi dengan timestamp sama, dan batas tengah malam WIB. Contoh: `2026-09-18T17:00:00Z` termasuk tanggal 19 September WIB; satu milidetik sebelumnya tidak.
- [ ] Jalankan `npm test -- 'app/(app)/history/history-list.test.tsx'` dan pastikan kasus baru gagal.
- [ ] Pertahankan requireSession di page. Pindahkan renderer desktop/mobile ke HistoryList tanpa menghapus wrap teks lokal. Serialisasi timestamp menjadi ISO string pada boundary server → client.
- [ ] Gunakan filter lot berdasarkan ID, bukan nama. Parameter `?lot=ID` mengisi filter awal melalui `searchParams` server yang di-await sesuai Next 16. ID tidak valid diabaikan dengan aman. Sinkronkan filter ketika prop initialLotId berubah saat navigasi.
- [ ] Filter tanggal memakai tanggal kalender WIB:

```ts
const wibDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" })
    .format(new Date(iso));
```

  Bandingkan hasil YYYY-MM-DD dengan tanggal awal/akhir inklusif. Jika awal > akhir, tampilkan pesan dekat kontrol dan jangan diam-diam membalik tanggal. Urut terbaru: timestamp menurun, lalu ID menurun.
- [ ] Tambahkan label `Menampilkan X dari Y transaksi`, `Reset filter`, serta empty state khusus hasil filter. CSV tetap seluruh riwayat; ubah label menjadi `Unduh semua CSV` agar tidak menyiratkan ekspor hasil filter.
- [ ] Ulangi tes dan periksa mobile/desktop dengan filter yang sama. Pastikan jumlah, tanda +/−, nama, alasan, catatan, dan timestamp konsisten.

**Selesai jika:** transaksi satu lot dapat ditemukan dari tautan receipt tanpa pencarian ulang; filter tanggal benar di WIB; CSV tidak menyesatkan.

## Task 5 — Dashboard mengarah ke tindakan dan tidak menyimpulkan kualitas

**Modify:** `web/app/(app)/_dashboard/stock-bars.tsx`, `outflow.tsx`, `recipients.tsx`, `web/app/(app)/rak/lot-list.tsx`.
**Create test:** `web/app/(app)/_dashboard/stock-bars.test.tsx`.

- [ ] Tes: nama lot memiliki href berdasarkan ID; umur >30 hari tetap angka tanpa label kualitas; chip terpilih mengumumkan state; reset menghapus kedua filter; kombinasi filter tanpa hasil punya jalan kembali.
- [ ] Jalankan `npm test -- 'app/(app)/_dashboard/stock-bars.test.tsx'`; konfirmasi perilaku baru belum tersedia.
- [ ] Ganti nama lot dengan Link menuju `/rak#lot-ID`. Tambahkan target `id={`lot-${lotId}`}` dan `tabIndex={-1}` pada baris Rak. LotList membaca hash saat mount dan `hashchange`, membuka target, mengubah status bila diperlukan, lalu scroll dan fokus tanpa timeout arbitrer. Hash invalid tidak mengubah daftar.
- [ ] Hapus `pastPrime` serta teks `lewat masa prima`; pertahankan `daysSince`. Jangan menggantinya dengan indikator merah/kuning atau threshold baru.
- [ ] Tambahkan `aria-pressed` pada chip proses/profil roast. Tambahkan tombol `Reset filter`, jumlah hasil, dan teks `Filter hanya untuk Stok per lot` supaya pengguna tidak mengira peta/total ikut difilter. Pertahankan logika AND antar dimensi dan OR dalam dimensi yang sudah ada.
- [ ] Jelaskan skala bar: `Panjang bar dibandingkan stok terbesar dalam hasil ini.` Tambahkan `Sepanjang waktu` pada panel outflow dan penerima. Jangan membangun filter periode Dashboard dalam task ini.
- [ ] Ulangi tes; cek link ke lot aktif, lot habis, ID tak ada, navigasi kembali, serta fokus keyboard.

**Selesai jika:** klik lot membawa pengguna langsung ke form yang benar; filter dan periode data jelas; tidak ada klaim kualitas roast tanpa dasar.

## Task 6 — Aksesibilitas dan ketahanan antarmuka

**Modify:** `web/app/(app)/layout.tsx`, `web/app/(app)/dashboard/page.tsx`, `rak/page.tsx`, `history/page.tsx`, `web/app/login/page.tsx`, `credentials-form.tsx`, `web/app/_landing/reveal.tsx`, `web/app/globals.css`, serta kelas kontrol pada form Rak dan filter Dashboard.
**Create tests:** `web/app/login/credentials-form.test.tsx`, `web/app/_landing/reveal.test.tsx`.

- [ ] Buat tes login dengan mocked action: email tetap sama setelah error, toggle password tidak submit, pending menonaktifkan submit. Buat tes Reveal bahwa konten tidak diawali keadaan tersembunyi yang menunggu effect.
- [ ] Jalankan `npm test -- app/login/credentials-form.test.tsx app/_landing/reveal.test.tsx`; catat kegagalan awal.
- [ ] Tambahkan skip-link sebagai elemen fokus pertama di shell aplikasi:

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-10 focus:rounded-md focus:bg-panel focus:px-4 focus:py-3 focus:text-ink focus:outline-2 focus:outline-amber">
  Lewati ke konten
</a>
```

  Main memakai `id="main-content" tabIndex={-1}`. Tambahkan metadata title eksplisit `Dashboard — Coffee Ledger`, `Rak — Coffee Ledger`, `Riwayat — Coffee Ledger`, dan `Masuk — Coffee Ledger` pada server page masing-masing. Login memakai `<main>` dan ruang vertikal agar tetap terbaca di layar pendek.
- [ ] Perbesar area sentuh Edit, disclosure, filter, input, dan tombol aksi ke target kenyamanan 44 px. Input mobile memakai `text-base sm:text-sm`. Pertahankan fokus yang jelas dan jangan mematikan outline tanpa pengganti. Ini target desain, bukan klaim kepatuhan menyeluruh terhadap WCAG.
- [ ] Email login menjadi controlled state. Password tetap tidak disimpan di storage/log; tambahkan tombol `type="button"` dengan label `Tampilkan password`/`Sembunyikan password`, default tersembunyi. Jangan menyentuh provider, allowlist, atau hashing.
- [ ] Untuk solusi minimal yang tahan gagal, hapus mekanisme observer/opacity dari Reveal, pertahankan API pembungkus dan className. Konten dirender terlihat sejak HTML pertama. Hapus aturan `.reveal` yang menjadi tidak terpakai; jangan menambahkan dependency animasi baru. Hover/focus tetap dipertahankan.
- [ ] Uji browser dengan JS dimatikan: isi landing dan tautan Masuk terlihat. Uji reduced-motion, zoom browser 200%, Tab/Shift+Tab, Enter/Space, lebar 320/390/768/1280 px, dan login pada layar pendek. Verifikasi tidak ada overflow horizontal baru.

**Selesai jika:** tugas utama bisa dijalankan dengan keyboard, kontrol nyaman disentuh, login gagal tidak menghapus email, dan landing tidak menjadi kosong jika JavaScript gagal.

## Task 7 — Verifikasi, dokumentasi, dan gate rilis

**Modify:** `docs/ui-ux-audit-2026-09-13.md`; aset `web/public/dashboard-preview.png` dan `web/public/rak-preview.png` hanya jika hasil akhir sudah stabil.

- [ ] Jalankan dari `web/`: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`; semua harus exit 0. Build menggunakan environment lokal/test yang sesuai dan tidak menjalankan migrasi.
- [ ] Jalankan `git diff --check` dan review perubahan per file. Pastikan tidak ada perubahan schema/auth provider, dependency UI baru, atau penghapusan perubahan pengguna.
- [ ] Verifikasi skenario end-to-end pada environment terisolasi: cari lot → buka → catat → lihat receipt → buka Riwayat terfilter; ulangi dengan error, stok habis, dan hadiah. Tes sukses tidak boleh menggunakan stok pemilik di production.
- [ ] Uji fixture 0, 1, 11, dan 50 lot; nama panjang tanpa spasi; origin tidak dikenal; banyak penerima; transaksi lintas tengah malam WIB. Pemeriksaan visual harus memakai data lebih padat daripada screenshot dua lot.
- [ ] Ambil screenshot desktop/mobile dari komponen terbaru dengan label data contoh. Jangan mengklaim screenshot ini sebagai keadaan production. Jalankan audit aksesibilitas browser dan catat isu yang tersisa, bukan hanya skor agregat.
- [ ] Dokumentasikan hasil aktual, versi/HEAD, batas pengujian, dan daftar file. Tandai implementasi selesai hanya setelah pengujian terkait lolos. Jika membuat commit ketika eksekusi telah diizinkan, stage hanya file task yang direview; jangan `git add .` pada worktree campuran.
- [ ] Siapkan ringkasan rilis. Setelah pengguna menginstruksikan deploy: pastikan target branch/environment, deploy SHA yang telah diuji, lalu verifikasi status platform dan halaman production. Halaman privat memerlukan sesi pemilik yang sah; jangan melewati autentikasi untuk smoke test.
- [ ] Rollback, bila diperlukan, menggunakan deployment terakhir yang diketahui baik. Tidak ada rollback database dalam scope rencana ini karena tidak ada migrasi baru.

**Definition of done:** perilaku dan tampilan terverifikasi, tes/lint/typecheck/build lolos, pekerjaan lokal yang lama tetap terjaga, serta status lokal dan production dibedakan secara eksplisit.

## Di luar iterasi ini

- Kolom penerima terpisah dan normalisasi data hadiah lama: perlu keputusan model data dan migrasi khusus.
- Server-side pagination Riwayat: evaluasi setelah mengukur jumlah transaksi, payload, dan waktu render; jangan menyebut filter client sebagai solusi skalabilitas.
- Ambang kesegaran yang dapat diatur, preset dosis, undo transaksi, dan redesign visual besar: bukan bagian temuan yang harus diselesaikan sekarang.

## Pemeriksaan kelengkapan rencana

- Peta/fallback → Task 1; Rak/search/draft → Task 2; receipt/penerima → Task 3.
- Riwayat → Task 4; link lot, umur roast, periode dan state filter → Task 5.
- Target sentuh, keyboard, judul, login, ketahanan landing → Task 6.
- Perubahan lokal lama, screenshot, pengujian dan pembeda production → Task 0 dan 7.
- Tidak ada implementasi aplikasi, transaksi database, commit, atau deployment yang dilakukan saat menulis dokumen ini.
