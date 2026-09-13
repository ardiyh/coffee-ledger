# Coffee Ledger web

Next.js 16, React 19, Tailwind v4, Drizzle, Neon Postgres, dan Auth.js.
Gunakan Node.js 22. Landing `/` bersifat publik; Dashboard, Rak, Riwayat, dan CSV
memerlukan akun Google pemilik.

## Menjalankan aplikasi

Jalankan dari direktori `web/`:

```bash
npm ci
cp .env.example .env.local
# Isi variabel di .env.local sebelum langkah berikutnya.
npm run db:migrate
npm run dev
```

- `DATABASE_URL`: koneksi PostgreSQL Neon untuk lingkungan yang sedang dipakai.
- `AUTH_SECRET`: buat dengan `openssl rand -base64 32`.
- `AUTH_GOOGLE_ID` dan `AUTH_GOOGLE_SECRET`: kredensial OAuth Google.
- `AUTH_ALLOWED_EMAIL`: satu email pemilik yang diizinkan masuk.

Redirect URI Google untuk lokal: `http://localhost:3000/api/auth/callback/google`.
Untuk Vercel, tambahkan URI yang sama dengan domain deployment dan atur variabel
environment melalui konfigurasi proyek. Root Directory Vercel adalah `web`.

Next.js dan Drizzle membaca environment shell terlebih dahulu, lalu file lokal
sesuai urutan Next.js, termasuk `.env.local` sebelum `.env`. File `.env` pada root
repo tidak dibaca oleh aplikasi web. Jangan commit kredensial.
Perintah Drizzle default ke mode development, sama seperti `next dev`.
Untuk memakai file `.env.production*`, jalankan dengan `NODE_ENV=production`.

## Pemeriksaan

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Test ledger memakai PGlite dengan migrasi asli. Test form memakai React Testing
Library dan jsdom; Server Actions diganti pada batas jaringan. Tidak ada penulisan
ke Neon oleh test ini. CI menjalankan test, lint, typecheck, dan build menggunakan
konfigurasi placeholder, tanpa akses ke database aplikasi.

## Migrasi dan integritas stok

```bash
npm run db:generate -- --name nama_perubahan
npm run db:migrate
```

Periksa target `DATABASE_URL` sebelum migrasi. Migrasi `0001_stock_integrity`
mengubah gram dari float menjadi `numeric`, menambah constraint gram dan arah/alasan,
serta memasang trigger pemeriksaan saldo. Migrasi menolak data tidak valid dan saldo
negatif yang sudah ada; data tersebut harus diperiksa, bukan dibersihkan otomatis.
Uji migrasi pada lingkungan pengembangan sebelum rollout produksi, lalu jalankan
migrasi sebelum versi aplikasi yang bergantung padanya.
Untuk produksi: `NODE_ENV=production npm run db:migrate`. Environment shell tetap
memiliki prioritas tertinggi, jadi pastikan URL yang diekspor memang targetnya.

Trigger berisi logika tambahan di SQL karena Drizzle tidak menghasilkan trigger dari
`schema.ts`. Pertahankan SQL tersebut ketika menambah migrasi. Ia memperbarui baris
lot tanpa mengubah nilai `created_at`, untuk mengurutkan penulis bersamaan. Saldo lalu
dihitung menggunakan `numeric` sebelum transaksi OUT diizinkan. Snapshot transaksi
yang sudah kedaluwarsa pada isolation level lebih tinggi gagal melalui PostgreSQL.
Rujukan: [snapshot fungsi PostgreSQL](https://www.postgresql.org/docs/current/xfunc-volatility.html).

Stok awal memakai dua data-modifying CTE dalam satu pernyataan SQL, sehingga tetap
atomik dengan driver Neon HTTP. Riwayat transaksi tetap menjadi sumber saldo;
penyesuaian stok dilakukan dengan transaksi ADJUST baru.

## Alur UI

- Rak menampilkan lot aktif terlebih dahulu. Lot habis dapat dibuka untuk diedit
  atau diisi ulang. Default transaksi adalah Seduh untuk lot aktif dan Masuk untuk
  lot kosong.
- Form mempertahankan isian ketika ditolak dan mengosongkannya setelah berhasil.
- Edit mengubah metadata lot, tidak mengubah transaksi atau angka stok.
- Label grafik membungkus pada layar kecil. Halaman menyediakan status pemuatan
  dan tombol muat ulang ketika data belum bisa diambil.

Python di `../src/coffee_ledger/` membuka PostgreSQL dengan transaksi READ ONLY;
schema produksi dimiliki Drizzle. SQLite tetap tersedia untuk eksperimen lokal.
