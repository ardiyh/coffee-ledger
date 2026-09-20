# Audit UI/UX Coffee Ledger

Catatan terbaru: lihat [audit implementasi 20 September 2026](ui-ux-implementation-audit-2026-09-20.md)
untuk empat temuan lanjutan, perbaikannya, dan hasil 198 tes. Angka pengujian
di dokumen ini tetap merupakan hasil historis 13–14 September, bukan status
rilis terbaru.

13 September 2026. Panduan: `design-taste-frontend` untuk landing dan
`redesign-existing-projects` untuk aplikasi. Mode: mempertahankan identitas.
Variasi desain 3/10, intensitas gerak 2/10, kepadatan informasi 5/10.

Status 14 September 2026: rekomendasi telah diterapkan dan diperiksa ulang.
Temuan di bawah tetap dipertahankan sebagai catatan kondisi awal.

## Arah desain

Pencatat kopi pribadi dengan tampilan gelap, hangat, dan tenang. Pertahankan
Geist, angka tabular, aksen amber, navigasi atas, serta tanda +/− yang melengkapi
warna transaksi. Perubahan paling bernilai adalah mempercepat pembacaan stok
dan pencatatan harian. Penambahan animasi besar, font baru, dan library UI belum
memiliki alasan yang kuat.

## Dasar pemeriksaan

Landing dan login diperiksa langsung di browser lokal. Dashboard, Rak, dan
Riwayat dirender dari komponen halaman asli dengan data contoh serta pengganti
auth/layanan data dalam proses render terpisah. Layout diperiksa pada lebar
390 dan 960 px dengan CSS aplikasi. Render contoh bersifat statis: pemeriksaan
ini tidak menguji sesi OAuth atau transaksi end-to-end. Tidak ada data Neon
yang diubah dalam audit ini.

## Prioritas perbaikan

### Tinggi: keterbacaan tombol ketika hover

`web/app/globals.css:17` mendefinisikan `--amber-dim: #8a6538`. Tombol login
menggunakannya bersama teks `#13110f` berukuran 14 px. Warna aktual sudah
dikonfirmasi lewat computed style browser. Kontras turun dari 7,15:1 pada
kondisi normal menjadi 3,59:1 saat hover. Ini di bawah minimum 4,5:1 untuk teks
normal, termasuk teks pada kondisi hover, dalam
[WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Rekomendasi: gunakan token hover amber yang lebih terang dan audit seluruh
pemakai `hover:bg-amber-dim`, termasuk tombol pencatatan. Verifikasi warna
akhir melalui browser, bukan hanya screenshot.

### Tinggi: gram transaksi tersembunyi di Riwayat mobile

`web/app/(app)/history/page.tsx:44` menggunakan tabel lima kolom dalam area
scroll horizontal. Dengan dua transaksi contoh pada layar 390 px, lebar tabel
497,77 px sedangkan kontainernya 358 px. Pada posisi awal, kolom gram dan catatan
berada di luar area baca, padahal besaran masuk/keluar adalah informasi utama.

Rekomendasi: tampilan daftar transaksi khusus mobile. Letakkan nama lot dan
angka bertanda pada baris utama, alasan dan waktu di bawahnya, lalu catatan
jika tersedia. Pertahankan tabel pada desktop. Verifikasi semua informasi
tetap tersedia tanpa geser horizontal pada 320–390 px.

### Sedang: navigasi kurang nyaman disentuh

`web/app/(app)/nav-links.tsx:19` dan tombol Keluar hanya setinggi 20 px pada
pengukuran browser. Halaman aktif dibedakan secara visual melalui warna saja.

Rekomendasi: perluas area interaksi menjadi sekitar 44 px, pertahankan
`aria-current`, tambahkan penanda aktif berupa garis atau permukaan halus,
dan buat indikator fokus keyboard konsisten. Ukuran 44 px adalah target
kenyamanan di sini, bukan klaim bahwa semua target saat ini melanggar WCAG.

### Sedang: ringkasan Dashboard mengambil terlalu banyak ruang mobile

`web/app/(app)/_dashboard/stat-tiles.tsx:17` menumpuk tiga kartu setara.
Pada layar 390 px, bagian ini setinggi 362 px dan berakhir pada posisi y=499,
sebelum grafik stok dimulai. Total lot memperoleh ruang yang sama besar
dengan total stok meskipun lebih jarang diperlukan untuk keputusan harian.

Rekomendasi: jadikan total stok informasi utama, dengan lot aktif dan total
lot sebagai dua angka sekunder berdampingan. Tambahkan judul Dashboard dan
tautan pencatatan menuju Rak. Bandingkan posisi awal grafik sebelum/sesudah.

### Sedang: informasi peta bergantung pada hover

`web/app/(app)/_dashboard/origin-map.tsx:64` memakai lingkaran dengan `<title>`
tanpa kontrol fokus atau daftar pendamping. Nama dan stok tidak tersedia
sebagai teks yang selalu terlihat. Lot dengan origin sama juga diproyeksikan
ke koordinat yang sama sehingga markernya bertumpuk.

Rekomendasi: tampilkan daftar origin beserta total gram dan jumlah lot di
bawah peta. Kelompokkan marker per origin agar maknanya konsisten dengan
daftar. Informasi tetap dapat dibaca dengan sentuhan maupun keyboard.

### Sedang: tambah lot makin sulit ditemukan ketika Rak bertambah

`web/app/(app)/rak/page.tsx` menempatkan disclosure Tambah lot baru setelah
seluruh lot aktif. Urutan ini mendukung pencatatan harian, tetapi akses untuk
menambah lot akan semakin jauh ketika daftar tumbuh.

Rekomendasi: tambahkan akses langsung dari header Rak ke form yang ada,
dengan pembukaan disclosure dan fokus yang jelas. Form transaksi harian
tetap dipertahankan dekat lot terkait.

### Rendah: konsistensi login dan presentasi landing

Login menggunakan bahasa Inggris sementara landing dan aplikasi memakai
bahasa Indonesia. Login juga tidak memiliki tautan kembali ke beranda.
Gunakan “Masuk dengan Google”, penjelasan akses pemilik dalam bahasa Indonesia,
dan tautan kembali.

Landing memang merupakan studi kasus teknis, sehingga pembahasan arsitektur
dan stack relevan untuk dipertahankan. Namun screenshot merupakan versi lama.
Bagian keputusan warna juga mengatakan swatch clay dipakai di seluruh aplikasi,
sedangkan teks OUT kini menggunakan token `--clay-ink` yang lebih terang.
Perbarui screenshot sesudah perbaikan UI, dan bedakan eksperimen warna historis
dari warna teks saat ini tanpa menganggap angka ΔE lama berlaku pada warna baru.

## Urutan implementasi yang disarankan

1. Kontras hover dan area interaksi navigasi.
2. Riwayat mobile dan ringkasan Dashboard.
3. Daftar pendamping peta, akses Tambah lot, dan bahasa login.
4. Pembaruan screenshot serta keterangan landing setelah UI stabil.

## Hasil tindak lanjut — 14 September 2026

Saat pekerjaan dilanjutkan, commit hingga `9139dfa` sudah memuat perbaikan
hover, navigasi, daftar Riwayat mobile, ringkasan stok, daftar origin,
akses Tambah lot, dan bahasa login. Perbaikan tersebut dipertahankan.

Penyempurnaan lanjutan:

- Ringkasan Dashboard menggunakan tiga kolom pada desktop, dengan total stok
  tetap menjadi informasi utama. Tinggi bagian ini terukur 110 px pada lebar
  960 px dan 208 px pada mobile, dibanding 362 px pada audit mobile awal.
- Nama lot dan catatan panjang tanpa spasi kini dapat membungkus di Riwayat
  mobile, sementara angka gram tetap utuh. Kasus uji pada lebar 320 px
  sebelumnya memperlebar dokumen menjadi 533 px; sesudah perbaikan tetap 320 px.
- Peta memiliki label aksesibel; jumlah gram dalam daftar origin tidak terpisah
  dari satuannya.
- Screenshot landing diperbarui dari komponen Dashboard dan Rak terbaru,
  menggunakan data contoh, dengan keterangan eksplisit. Aset baru:
  `web/public/dashboard-preview.png` dan `web/public/rak-preview.png`.
- Penjelasan warna membedakan eksperimen ΔE historis dari varian clay lebih
  terang yang sekarang digunakan untuk teks transaksi keluar.

Verifikasi:

- Dashboard dan Riwayat diperiksa pada lebar 320, 390, dan 960 px tanpa
  overflow horizontal, termasuk nama lot serta catatan panjang tanpa spasi.
- Area navigasi terukur 44 px. Tautan Tambah lot membuka disclosure asli
  dan memfokuskan bagian form tanpa tambahan JavaScript.
- Kedua screenshot baru berhasil dimuat pada landing di browser.
- 70 tes web, ESLint, TypeScript, dan build produksi berhasil.
- Lighthouse mobile pada landing build produksi lokal: performa 96,
  aksesibilitas 100, dan best practices 100. LCP 2,8 detik; masih ada saran
  pengurangan JavaScript dan resource pemblokir render. Ini pengukuran lab
  lokal, bukan jaminan performa deployment atau audit aksesibilitas lengkap.

Pemeriksaan halaman privat menggunakan render komponen asli dengan data contoh,
bukan sesi pemilik. Alur autentikasi dan transaksi end-to-end tidak diuji dalam
tindak lanjut UI ini. Tidak ada perubahan database atau deployment.
