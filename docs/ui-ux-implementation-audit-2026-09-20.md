# Audit implementasi UI/UX — 20 September 2026

**Penyelesaian berikutnya:** lihat [laporan rilis UI/UX](ui-ux-release-2026-09-20.md)
untuk E2E terisolasi, aksesibilitas, reflow, screenshot terbaru, dan status rilis.
Bagian di bawah merupakan riwayat hasil audit dan sesi lanjutan sebelumnya.

**Pembaruan sesi lanjutan:** UX-01 sampai UX-04 sudah diperbaiki dan diverifikasi
lokal pada HEAD `d2ff6b7`. Temuan awal di bawah dipertahankan sebagai riwayat;
lihat hasil verifikasi lanjutan di akhir dokumen. Ini belum menutup seluruh
Task 7 atau membuktikan perubahan sudah tersedia di production.

**Baseline audit:** HEAD `fee96f6`, beserta perubahan lokal yang sudah ada saat pemeriksaan.
**Panduan:** `karpathy-guidelines` — temuan berbasis reproduksi, perbaikan terarah, dan kriteria selesai yang dapat diuji.
**Rujukan:** [rencana implementasi](superpowers/plans/2026-09-19-ui-ux-follow-up-plan.md) dan [audit awal](ui-ux-audit-2026-09-13.md).

## Kesimpulan

Sebagian besar fitur dalam rencana sudah diimplementasikan, tetapi kriteria
selesai belum terpenuhi. Empat temuan berhasil direproduksi meskipun seluruh
191 tes otomatis, lint, typecheck, dan build lolos. Task 7, terutama pemeriksaan
layout serta dokumentasi hasil terbaru, masih perlu dituntaskan.

Dokumen ini mencatat hasil pemeriksaan sebelumnya pada tanggal yang sama;
penulisan dokumen tidak menjalankan ulang pengujian atau memperbaiki aplikasi.
Status di bawah bukan klaim keadaan production.

## Metode dan batas pemeriksaan

- Membandingkan kode dengan rencana implementasi serta perubahan sejak baseline
  rencana `5c1c774`.
- Menguji interaksi tambahan menggunakan komponen React asli, Testing Library,
  jsdom, dan mock pada batas Server Actions. Tidak ada transaksi database nyata.
- Memeriksa layout di Chrome headless menggunakan render komponen asli, CSS
  build aplikasi, dan iframe berlebar 320 serta 390 px. Pengukuran ini memakai
  fixture, bukan halaman privat production yang sudah login.
- Reproduksi tambahan dijalankan sebagai skrip diagnostik sementara di memori;
  belum menjadi regression test yang disimpan di repository.
- Autentikasi production, transaksi end-to-end akun pemilik, dan deployment
  tidak diuji. Tidak ada kode aplikasi atau data production yang diubah.

## Temuan

### UX-01 — Tinggi: draft edit hilang ketika kembali melalui tombol Catat

**Lokasi:** `web/app/(app)/rak/lot-row.tsx:164`, fungsi `toggleOpen`.
**Terkait plan:** Task 2, mempertahankan draft ketika beralih lot.

Reproduksi:

1. Buka Edit pada lot A.
2. Ganti nama menjadi `Draft belum disimpan`, tanpa menyimpan.
3. Buka pencatatan lot B.
4. Kembali melalui tombol `Catat untuk A`.
5. Buka Edit A lagi.

**Hasil aktual:** nama kembali ke nilai awal (`Lot 1` pada fixture).
**Hasil yang diharapkan:** draft tetap utuh sampai pengguna memilih Batal atau
Simpan berhasil.

Penyebab: membuka pencatatan memanggil `setEditing(false)`, yang meng-unmount
EditLotForm dan membuang state draft. Tes yang ada mencakup kembali melalui
tombol Edit, tetapi belum mencakup jalur kembali melalui Catat.

**Arah perbaikan:** pisahkan visibilitas/mode panel dari masa hidup draft.
Jangan menghapus draft hanya karena pengguna berpindah mode.

Kriteria penerimaan:

- [ ] Jalur Edit A → Catat B → Catat A → Edit A mempertahankan semua draft.
- [ ] Batal tetap membuang perubahan; Simpan berhasil memperbarui data.
- [ ] Perpindahan panel tidak mencatat transaksi atau mengirim edit otomatis.
- [ ] Tambahkan regression test untuk jalur tersebut.

### UX-02 — Tinggi: kontrol baru menyebabkan overflow horizontal mobile

**Lokasi:**

- `web/app/(app)/rak/lot-row.tsx:228` — grup stok, Edit, dan Catat.
- `web/app/(app)/history/history-list.tsx:124` — label dan dropdown Lot.

**Terkait plan:** Task 6 dan 7, responsivitas serta fixture nama panjang.

Fixture nama lot: `El Salvador, Roasted by Ease Coffee (Chiba, Japan)`.

| Halaman | Lebar viewport | Lebar dokumen terukur |
|---|---:|---:|
| Rak | 320 px | 594 px |
| Rak | 390 px | 594 px |
| Riwayat | 320 px | 385 px |
| Riwayat | 390 px | 390 px |

Pengukuran berulang memberikan hasil yang sama. Login pada fixture pembanding
tetap selebar 320/390 px; dugaan awal overflow login tidak terkonfirmasi.

Penyebab di Rak: grup kontrol memakai `shrink-0` tanpa pembungkusan, sementara
tombol menampilkan nama lot lengkap. Pada fixture, tombol Catat sendiri
terukur sekitar 393 px. Di Riwayat, lebar intrinsik dropdown mengikuti opsi
panjang tanpa batas lebar yang sesuai kontainer.

**Arah perbaikan:** gunakan teks tombol singkat dengan accessible name lengkap,
izinkan grup kontrol membungkus, serta batasi lebar label/dropdown. Jangan
menutup masalah dengan `overflow-x: hidden` yang memotong kontrol.

Kriteria penerimaan:

- [ ] Pada 320 dan 390 px, `scrollWidth` dokumen tidak melebihi viewport.
- [ ] Nama panjang, termasuk teks tanpa spasi, tidak memotong gram atau tombol.
- [ ] Semua kontrol masih dapat disentuh dan diakses dengan keyboard.
- [ ] Periksa ulang desktop serta zoom browser 200%, bukan hanya mobile.

### UX-03 — Sedang: navigasi ulang ke hash lot yang sama tidak memindahkan fokus

**Lokasi:** `web/app/(app)/rak/lot-list.tsx:241`, effect scroll/focus.
**Terkait plan:** Task 5, navigasi Dashboard → Rak dan fokus keyboard.

Reproduksi:

1. Masuk ke Rak dengan `#lot-1`; fokus awal berpindah ke lot 1.
2. Buka lot 2 secara manual dan fokuskan input Cari.
3. Picu navigasi hash baru menuju `#lot-1`.

**Hasil aktual:** panel lot 1 terbuka, tetapi fokus tetap pada input Cari.

Penyebab: `focusedHashLotIdRef` dan state `hashLotId` mendeduplikasi berdasarkan
ID yang sama, bukan kejadian navigasi baru. Guard mencegah perebutan fokus saat
refresh biasa, tetapi juga menghalangi navigasi ulang yang memang diminta.

**Arah perbaikan:** bedakan kejadian navigasi eksplisit dari rerender/refresh
data. Pertahankan perlindungan agar refresh tak terkait tidak merebut fokus.

Kriteria penerimaan:

- [ ] Navigasi eksplisit berulang ke ID yang sama memindahkan fokus dan scroll.
- [ ] Refresh data tanpa navigasi tidak membuka kembali lot lama.
- [ ] Mengubah filter tidak merebut fokus dari kontrol yang sedang dipakai.
- [ ] ID invalid tetap diabaikan dengan aman.

### UX-04 — Sedang: hasil pencarian kosong bertentangan dengan lot yang terlihat

**Lokasi:** `web/app/(app)/rak/lot-list.tsx:326` dan kondisi `visible` pada baris 347.
**Terkait plan:** Task 2, empty state dan perlindungan konteks draft.

Reproduksi:

1. Buka panel pencatatan salah satu lot.
2. Isi Cari dengan teks yang tidak cocok dengan lot mana pun.

**Hasil aktual:** pesan `Tidak ada lot yang cocok` dan hitungan nol muncul,
tetapi satu lot masih terlihat karena kondisi `matchedIds.has(lotId) || isOpen`.

Mempertahankan panel terbuka merupakan keputusan yang disengaja untuk melindungi
draft. Kekurangannya adalah tidak ada penjelasan bahwa panel tersebut merupakan
pengecualian dari hasil filter.

**Arah perbaikan:** jelaskan perbedaan hasil pencarian dan lot yang tetap dibuka,
misalnya `0 lot cocok. Lot yang sedang dibuka tetap ditampilkan.` Jangan
menghapus draft hanya agar hitungan dan tampilan terlihat sesuai.

Kriteria penerimaan:

- [ ] Hasil cocok dan panel yang dipertahankan dijelaskan secara konsisten.
- [ ] Tidak ada empty state yang menyiratkan seluruh daftar kosong padahal ada panel.
- [ ] Draft dan request pending tetap terlindungi.
- [ ] Menutup panel mengembalikan tampilan ke hasil filter yang sebenarnya.

## Hasil verifikasi pada sesi audit

| Pemeriksaan | Hasil |
|---|---|
| `npm test` | 14 file tes, 191 tes lolos |
| `npm run lint` | Lolos |
| `npm run typecheck` | Lolos |
| `npm run build` | Lolos dengan konfigurasi database/auth dummy untuk build |
| `git diff --check` | Lolos |
| Reproduksi interaksi tambahan | UX-01, UX-03, UX-04 terkonfirmasi |
| Pengukuran browser dengan fixture | UX-02 terkonfirmasi |
| Production dan transaksi pemilik | Tidak diuji |

Kelulusan tes otomatis tidak menutup temuan yang belum dicakup tes tersebut.
Build produksi lokal juga tidak membuktikan deployment production berhasil.

## Status terhadap rencana dan tindak lanjut

Fitur cakupan peta, pencarian Rak, receipt, filter Riwayat, link Dashboard ke lot,
penghapusan klaim kualitas roast, skip-link, judul halaman, toggle password, dan
landing tanpa JS-gate sudah terdapat dalam kode. Namun, perlindungan draft,
navigasi ulang, dan responsivitas belum sepenuhnya memenuhi kriteria plan.

Task 7 belum dapat ditutup:

- Dokumentasi audit lama masih mencatat hasil 70 tes dan pemeriksaan sebelumnya.
- Screenshot lokal belum mencerminkan keseluruhan fitur terbaru.
- Pengujian end-to-end pada environment terisolasi dan verifikasi production
  belum dibuktikan oleh audit ini.
- Masih terdapat perubahan lokal dan aset untracked; status implementasi lokal
  tidak boleh disamakan dengan status rilis.

Urutan perbaikan: **UX-01 → UX-02 → UX-03 → UX-04**, lalu jalankan regression
test, pemeriksaan browser, dan lengkapi dokumentasi Task 7. Deploy tetap menjadi
langkah terpisah setelah ada instruksi dan verifikasi versi yang akan dirilis.

## Hasil sesi lanjutan — 20 September 2026

Sesi yang dilanjutkan menemukan implementasi perbaikan sudah tersimpan dalam
commit sebelumnya. Tidak ada penulisan ulang komponen aplikasi:

| Temuan | Implementasi | Verifikasi ulang | Status |
|---|---|---|---|
| UX-01 | `3aa560d`, diperjelas `061bb84`: masa hidup draft terpisah dari `panelView` | Edit A → Catat B → Catat A → Edit A tetap menampilkan `Draft belum disimpan` | Terverifikasi lokal |
| UX-02 | `d2ff6b7`: tombol Catat singkat, accessible name lengkap, kontrol membungkus, dropdown dibatasi | Rak dan Riwayat tidak overflow pada 320/390/768/1280 px | Terverifikasi lokal |
| UX-03 | `3aa560d`: kejadian hash memakai nonce, bukan hanya ID | Navigasi ulang ke `#lot-1` membuka panel dan memfokuskan `lot-1` | Terverifikasi lokal |
| UX-04 | `3aa560d`: pesan menjelaskan panel yang dipertahankan | Pesan kosong lama tidak muncul sendiri ketika satu panel masih terbuka; regression test pesan baru lolos | Terverifikasi lokal |

### Pengujian terkini

- `npm test`: **198 tes dalam 14 file lolos**, termasuk regression test yang
  ditambahkan sesi sebelumnya.
- `npm run lint` dan `npm run typecheck`: **lolos** setelah artefak debug sementara
  dirapikan. Kegagalan lint awal berasal dari delapan skrip CommonJS sementara,
  bukan komponen aplikasi.
- `npm run build`: **lolos**, menggunakan konfigurasi database/auth dummy untuk
  build tanpa migrasi atau transaksi nyata.
- Reproduksi interaksi tambahan memakai komponen asli dengan mock Server Actions;
  hasil UX-01 dan UX-03 dibandingkan langsung dengan reproduksi audit awal.
- Pemeriksaan layout memakai Chromium/Playwright, komponen asli yang dirender
  statis, CSS build terbaru, dan fixture 50 lot/transaksi. Fixture memuat nama
  panjang serta nama/catatan tanpa spasi. Pada Rak, Riwayat, dan login,
  `scrollWidth` sama dengan viewport untuk 320, 390, 768, dan 1280 px.
  Font eksternal tidak dimuat dalam fixture ini; ini bukan pengujian halaman
  production terautentikasi atau seluruh interaksi browser end-to-end.

### Artefak debug dan kredensial

Delapan file `web/__tmp_*.js` dari sesi sebelumnya berisi skrip pemeriksaan
sementara dan kredensial literal. Kredensial dalam skrip tersebut diganti
dengan `COFFEE_TEST_EMAIL` / `COFFEE_TEST_PASSWORD`, lalu skrip dipindahkan ke
`/tmp/coffee-ui-debug-sanitized-0y0z1D/`. Skrip tidak dihapus dan masih dapat
diambil kembali selama direktori sementara itu tersedia. Nilai rahasia tidak
dicantumkan dalam dokumen ini dan tidak dipakai untuk verifikasi lanjutan.

Penggantian literal di file tidak mencabut kredensial atau menghapus salinannya
di log sesi sebelumnya. Pemilik sebaiknya mengganti password terkait; sesi
ini tidak mengubah konfigurasi autentikasi atau password production.

### Batas penyelesaian

Empat temuan audit kini tertutup pada verifikasi lokal. Task 7 secara keseluruhan
masih memerlukan screenshot terbaru, pemeriksaan aksesibilitas/zoom lengkap,
dan alur end-to-end pada environment terisolasi. Deployment dan pemeriksaan
production tetap belum dilakukan. Perubahan lokal lama dipertahankan; tidak
ada commit, push, migrasi, atau perubahan data production dalam sesi lanjutan.
