# Penyelesaian UI/UX — 20 September 2026

Rujukan: [plan implementasi](superpowers/plans/2026-09-19-ui-ux-follow-up-plan.md)
dan [audit implementasi](ui-ux-implementation-audit-2026-09-20.md).

## Lingkup rilis

- Empat temuan UX-01–UX-04 sudah diperbaiki pada commit `3aa560d`, `061bb84`,
  dan `d2ff6b7`: draft edit, navigasi hash berulang, overflow Rak/Riwayat,
  serta penjelasan hasil pencarian.
- Perubahan UI lokal yang tertunda ikut disiapkan: ringkasan Dashboard desktop,
  screenshot landing terbaru dengan data contoh, serta penjelasan warna.
- Verifikasi akhir menemukan overflow tambahan Dashboard pada 320 px
  (`scrollWidth` 332 px). Grup pengurutan kini dapat membungkus.
- Kontrol peta dan filter Riwayat yang sebelumnya 30–34 px kini minimal 44 px.
- Tidak ada migrasi atau perubahan aturan ledger, provider autentikasi,
  maupun data production dalam pekerjaan ini.

## Verifikasi yang dapat diulang

Jalankan dari `web/`:

```sh
npm ci
npx playwright install chromium
npm test
npm run lint
npm run typecheck
npm run build
npm run test:ui
```

`test:ui` membuat salinan aplikasi tanpa `.env*`, memakai akun fixture dan
database PGlite sementara. Hanya adapter database di salinan itu yang diganti;
schema/trigger dari migrasi asli, login Credentials, halaman, Server Actions,
service, dan repository tetap dijalankan. URL production tidak dapat diberikan
sebagai target skrip. Ini menguji alur penuh UI → action → ledger, tetapi tidak
menguji driver Neon HTTP atau sesi OAuth Google.

### Hasil lokal

| Pemeriksaan | Hasil |
|---|---|
| Unit/integration tests | 198 tes, 14 file lolos |
| Lint, typecheck, build | Lolos |
| Login | Redirect halaman privat, gagal login mempertahankan email, login fixture berhasil |
| Seduh | 250 g → 232 g setelah 18 g, receipt benar, tautan membuka Riwayat lot terkait |
| Stok berlebih | 999 g ditolak; isian dan saldo 232 g dipertahankan |
| Hadiah | Penerima Rina, keluar 5 g, saldo menjadi 227 g |
| Stok habis | Lot kedua 125 g → 0; receipt bertahan setelah panel ditutup |
| Axe | Tidak ada violation terdeteksi pada landing, login, Dashboard, Rak, Riwayat |
| Responsif | Lima halaman tanpa overflow pada 320, 390, 640, 768, dan 1280 px |
| Target kontrol | Tombol/input/select/summary yang terlihat di main minimal 44 px |
| Reflow | Pembesaran CSS 200% pada 1280 px tidak membuat dokumen overflow |
| Keyboard | Skip-link memindahkan fokus ke main; regression test hash ulang lolos |
| Ketahanan landing | Konten tetap terlihat dengan reduced motion dan JavaScript dimatikan |

Axe memakai tag WCAG 2 A/AA, 2.1 AA, 2.2 AA, dan best practice. Hasil ini bukan
sertifikasi WCAG atau jaminan seluruh assistive technology. Pembesaran CSS dan
viewport 640 px menguji reflow, bukan seluruh perilaku zoom native setiap browser.
Uji data padat dengan 50 lot/nama panjang sudah dicatat pada sesi verifikasi
sebelumnya; tes browser rilis menggunakan tiga lot dan transaksi fixture nyata.

### Screenshot

- [Dashboard terbaru](../web/public/dashboard-preview.png).
- [Rak terbaru](../web/public/rak-preview.png).

Keduanya diambil dari aplikasi terisolasi setelah transaksi fixture, bukan dari
stok pemilik. Aset desktop berukuran 1200×900; bukti mobile dan JSON pengujian
disimpan di direktori sementara yang dicetak `test:ui`. Caption landing menyatakan
data contoh. Overlay development dikeluarkan dari screenshot, bukan konten aplikasi.

Untuk memperbarui ulang aset: `UPDATE_UI_SCREENSHOTS=1 npm run test:ui`.
CI menjalankan `test:ui` tanpa menulis ulang screenshot.

## Status production

Verifikasi lokal selesai; status deployment dan smoke test production akan
dicatat setelah rilis selesai. Jangan menafsirkan hasil build lokal sebagai
bukti deployment. Target yang diperiksa adalah branch `main` pada
`ardiyh/coffee-ledger`, dengan domain `https://coffee-ledger-psi.vercel.app`.

## Catatan keamanan

Skrip debug lama sudah disanitasi dan diarsipkan, sebagaimana dicatat pada audit.
Password yang pernah tertulis di skrip/log tetap sebaiknya diganti pemilik;
rilis UI ini tidak merotasi password atau secret production secara otomatis.
