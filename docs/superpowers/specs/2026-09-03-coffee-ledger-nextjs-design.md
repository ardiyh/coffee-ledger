# Coffee Ledger v2 — Next.js + Vercel

**Tanggal:** 2026-09-03
**Status:** Disetujui, siap masuk rencana implementasi

## 1. Konteks

Coffee Ledger sekarang: Streamlit (Python) di Streamlit Cloud, core `src/coffee_ledger/`
(models / repository / service), 19 test hijau, data di Neon Postgres. Fase 0–3 selesai.

Keputusan: pindah UI ke Next.js dengan deploy di Vercel. Alasannya belajar full-stack TS;
keputusan stack sudah final dan tidak dibahas ulang di dokumen ini.

Dua batasan yang menentukan seluruh desain:

1. **Single-user dengan login.** URL Vercel itu publik; tanpa auth siapa pun yang tahu URL
   bisa menulis ke DB. Tapi cuma satu orang yang pakai.
2. **Streamlit tetap hidup sampai Next.js setara.** Konsekuensinya: **dua aplikasi menulis
   ke satu Neon DB yang sama** selama masa transisi. Ini sumber sebagian besar aturan di
   bawah.

## 2. Triase bug

Empat bug ditemukan saat review repo. Setelah dua batasan di atas, hanya satu yang layak
dikerjakan sekarang.

| Bug | Keputusan | Alasan |
|---|---|---|
| `datetime.now()` naive (`models.py:37,46`) | **Fix sekarang, di Python** | Selama dual-run, dua penulis dengan konvensi waktu berbeda masuk ke satu tabel. Setelah tercampur tidak bisa dipisahkan lagi — tidak ada penanda baris mana yang UTC dan mana WIB. Harus seragam sebelum Next.js menulis baris pertama. |
| N+1 query (`service.py:100`, `app.py:152`) | Tidak dikerjakan | Di Drizzle jadi satu query `GROUP BY lot_id, SUM(...)`. Memperbaikinya di Python = kerja untuk kode yang akan pensiun. |
| Race condition di `_record` | **Diterima sebagai asumsi** | Single-user + login. Locking untuk satu orang itu overkill. Dicatat, bukan diperbaiki. |
| `main()` sisa scaffold (`__init__.py`) | Tidak dikerjakan | Pensiun bersama Streamlit. |

## 3. Arsitektur

```
Vercel ─── Next.js (App Router)
             ├── UI (RSC + client forms)
             ├── Server Actions ......... gerbang tulis
             └── lib/ledger/ ............ core hasil port (TS murni)
                       │
                       │ @neondatabase/serverless (HTTP, tanpa pool)
                       ▼
                  Neon Postgres  ◄── dipakai bareng selama transisi
                       ▲
                       │ psycopg2 (pooled, pre_ping)
Streamlit Cloud ─── app.py (existing, pensiun belakangan)
```

Pemisahan tiga lapis yang sudah ada dipertahankan di TS. `service` tidak menyentuh koneksi
DB; `repository` tidak tahu aturan bisnis. Ini bagian repo yang paling sehat dan tidak ada
alasan mengubahnya cuma karena ganti bahasa.

## 4. Struktur folder

Satu repo, Next.js di subdirektori `web/`. Vercel punya setting *Root Directory*, jadi ini
didukung resmi dan riwayat git tetap satu.

```
coffee-ledger/
  src/coffee_ledger/     # Python, tetap sampai parity
  app/app.py             # Streamlit, tetap sampai parity
  web/
    app/
      page.tsx                 # dashboard
      lots/page.tsx
      record/page.tsx
      history/page.tsx
      login/page.tsx
      api/auth/[...nextauth]/route.ts
    lib/
      ledger/
        schema.ts              # Drizzle, hasil introspect
        errors.ts              # port errors.py
        repository.ts          # port repository.py
        service.ts             # port service.py
      db.ts
      auth.ts
    tests/ledger.test.ts
    middleware.ts
    drizzle.config.ts
```

## 5. Data layer

**Drizzle + `@neondatabase/serverless`.**

`schema.ts` dihasilkan `drizzle-kit introspect` langsung dari Neon, bukan diketik ulang.
Ini menjamin cocok dengan apa yang dibuat SQLModel.

Fakta schema yang sudah diverifikasi dari DDL (`CreateTable` dikompilasi ke dialek postgres):

```
lot:          id SERIAL, name VARCHAR, origin VARCHAR, varietal VARCHAR,
              roast_date DATE, created_at TIMESTAMP WITHOUT TIME ZONE, notes VARCHAR
transaction:  id SERIAL, lot_id INTEGER FK, ts TIMESTAMP WITHOUT TIME ZONE,
              kind txnkind, reason txnreason, grams FLOAT, note VARCHAR
```

- `kind` dan `reason` adalah **native Postgres ENUM** (`txnkind`, `txnreason`), bukan VARCHAR.
  Drizzle akan menghasilkan `pgEnum` dengan nilai persis `"IN"`/`"OUT"` dan
  `"ACQUIRE"`/`"BREW"`/`"GIFT"`/`"ADJUST"`.
- Tabel `transaction` memakai kata kunci SQL; Drizzle meng-quote otomatis.

**Aturan kepemilikan schema selama dual-run:** SQLModel adalah pemilik schema. Drizzle
**hanya introspect, tidak pernah menjalankan migrasi.** Setelah Streamlit pensiun, Drizzle
ambil alih. Aturan satu kalimat ini yang membuat dua aplikasi aman hidup berdampingan.

**Cold-start Neon.** Driver serverless jalan lewat HTTP, tidak punya connection pool yang
bisa basi. `pool_pre_ping`, `pool_recycle`, dan `wait_for_db()` adalah obat untuk penyakit
yang tidak ada di sisi ini — **tidak diportasi.**

## 6. Auth

Auth.js v5, satu provider Google, callback `signIn` yang hanya meloloskan satu email
(disimpan di env var, bukan hardcode). Middleware menjaga semua route kecuali `/login`.

**Strategi JWT, bukan database adapter.** Ini disengaja: adapter akan menambah tabel
`users` / `sessions` / `accounts` ke DB yang sedang dipakai bareng Streamlit, dan itu
melanggar aturan kepemilikan schema di §5. JWT = nol tabel baru.

**Koreksi 2026-09-03 — gerbang di layout saja tidak cukup.** Rencana awal menaruh gerbang
di middleware; itu diubah ke layout route group `(app)` karena auth yang hanya bersandar
pada middleware punya riwayat bypass. Tapi dokumentasi resmi Next.js
(`node_modules/next/dist/docs/01-app/02-guides/authentication.md`, bagian "Layouts and auth
checks") menyatakan layout **juga** bukan tempat yang benar untuk gerbang utama: karena
Partial Rendering, layout tidak dirender ulang saat navigasi antar-route, jadi sesi tidak
diperiksa di setiap perpindahan halaman. Layout juga tidak mengontrol apakah sisa route
ikut dirender.

Yang dianjurkan dokumen: periksa sedekat mungkin dengan sumber data — pola *Data Access
Layer*, sebuah `requireSession()` yang dipanggil di tiap page dan tiap Server Action.

Saat ini baru ada satu halaman di bawah `(app)`, jadi celah itu belum punya permukaan.
**Tapi begitu halaman dashboard/lots/catat/riwayat ditambahkan, `requireSession()` wajib
dipanggil di masing-masing page dan Server Action.** Redirect di layout tetap dipertahankan
sebagai kenyamanan UX (pengunjung tanpa sesi diarahkan ke login, bukan melihat error), bukan
sebagai batas keamanannya.

## 7. Alur data & error

Server Action memanggil service langsung. Tidak ada lapisan REST — tidak ada konsumen lain
yang membutuhkannya.

```
form → Server Action → service.recordBrew()
                          ├─ sukses    → revalidatePath()
                          └─ throw     → { error: msg } → dirender di form
```

Empat kelas error diport apa adanya: `LedgerError` (basis), `LotNotFoundError`,
`InvalidQuantityError`, `InsufficientStockError`. Di TS pakai pewarisan `class X extends
LedgerError`; `instanceof` bekerja normal. Polanya sama persis dengan `try/except
LedgerError` di `app.py:175`.

Semua penulisan lewat satu gerbang `_record()` seperti sekarang, dengan tiga aturan
berurutan: gram > 0 → lot ada → kalau OUT, stok cukup.

## 8. Testing

**Vitest + PGlite** (Postgres embedded di WASM) lewat `drizzle-orm/pglite`. Ini padanan
persis dari fixture SQLite in-memory di `conftest.py` — tanpa Docker, dan semantiknya
Postgres beneran sehingga enum dan `timestamptz` teruji apa adanya.

Diport (14 test): `test_service.py`, `test_validation.py`, `test_reads.py`. Angka assertion
disalin apa adanya (250 → brew 18 → 232, dst).

Tidak diport: `test_persistence.py` (spesifik SQLAlchemy), `test_app.py` (AppTest khusus
Streamlit).

**Kriteria sukses:** 14 test TS hijau dengan angka yang sama seperti pytest. Kalau angkanya
berbeda, port-nya salah.

## 9. Fix timezone (Fase 3.5)

Dikerjakan lebih dulu, di Python, sebelum Next.js menulis apa pun.

1. **Periksa data yang ada di Neon** — `SELECT id, ts FROM transaction ORDER BY id`.
   Tentukan mana yang ditulis dari Streamlit Cloud (UTC) dan mana dari laptop lokal (WIB).
   Ini menentukan langkah 4 dan belum bisa dilakukan tanpa akses DB.
2. **Test dulu (RED):** assertion dilakukan pada objek hasil `default_factory`
   (`Transaction().ts`), **bukan setelah round-trip DB.** Terverifikasi 2026-09-03:
   SQLite membuang `tzinfo` walaupun kolomnya `DateTime(timezone=True)` — nilai UTC-nya
   benar tapi kembali naive. Karena test suite jalan di SQLite dan produksi di Postgres,
   assertion round-trip akan merah walau kodenya benar.
3. **Kode:** `datetime.now(UTC)` sebagai `default_factory`, plus
   `sa_column=Column(DateTime(timezone=True))` di `Lot.created_at` dan `Transaction.ts`.
4. **SQL manual ke Neon.** `SQLModel.metadata.create_all()` hanya membuat tabel yang belum
   ada dan **tidak pernah meng-ALTER tabel yang sudah ada**, jadi langkah ini wajib manual:
   ```sql
   ALTER TABLE transaction ALTER COLUMN ts         TYPE timestamptz USING ts         AT TIME ZONE 'UTC';
   ALTER TABLE lot         ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
   ```
   Klausa `AT TIME ZONE 'UTC'` menyatakan bahwa nilai naive yang ada selama ini UTC. Kalau
   langkah 1 menemukan baris yang ditulis lokal (WIB), baris itu digeser terpisah sebelum
   ALTER dijalankan.
5. **Tampilan:** semua penyimpanan dalam UTC, semua tampilan dalam `Asia/Jakarta` —
   berlaku untuk Streamlit maupun Next.js. Konversi terjadi di lapisan tampilan saja,
   tidak pernah di service atau repository.

## 10. Fase & kriteria sukses

| Fase | Isi | Selesai kalau |
|---|---|---|
| 3.5 | Fix timezone (Python) | Test tzinfo hijau; kolom Neon bertipe `timestamptz` |
| 4a | Brand kit (skill `brandkit`) | Ada palet, logo, sistem tipografi |
| 4b | Next.js: auth + introspect + dashboard read-only | Bisa login; angka stok identik dengan Streamlit |
| 4c | Server Actions tulis + service diport + Vitest | 14 test TS hijau |
| 4d | Cek parity, pensiunkan Streamlit | Semua fitur setara |
| 5 | EDA | — |

README saat ini menomori EDA sebagai Fase 4; rencana ini mendorongnya ke Fase 5. README
perlu diperbarui di akhir Fase 4d. Streamlit boleh dipertahankan khusus untuk EDA —
pandas + notebook masih lebih cocok untuk itu daripada TS.

## 11. Bukan bagian dari pekerjaan ini

- Locking / transaksi untuk race condition — single-user.
- REST API — tidak ada konsumen selain UI sendiri.
- Port `wait_for_db` / `pool_pre_ping` — tidak relevan di driver HTTP.
- Tabel auth — strategi JWT.
- Multi-user, kolom `user_id`, migrasi kepemilikan data.
- Refactor Python di luar fix timezone.

## 12. Risiko & hal yang masih terbuka

- **Asal-usul baris lama belum diverifikasi.** §9 langkah 1 butuh akses ke Neon. Kalau
  ternyata ada campuran UTC dan WIB, klausa `USING` tunggal tidak cukup.
- **Asumsi Streamlit Cloud jalan di UTC** belum diverifikasi langsung; dikonfirmasi lewat
  langkah 1.
- **Session `TimeZone` Neon diasumsikan UTC.** Ini yang membuat urutan ALTER-vs-deploy tidak
  kritis (konversi naive↔aware di kedua arah memakai session TimeZone). Diverifikasi dengan
  `SHOW TimeZone;` di §9 langkah 1.
- **Round-trip Postgres belum diverifikasi lokal** — tidak ada Postgres maupun Docker di
  mesin dev. Diverifikasi langsung di Neon setelah ALTER.
- **Dual-run mengunci schema.** Selama Streamlit hidup, tidak boleh ada kolom baru dari sisi
  Drizzle. Kalau Next.js butuh kolom baru sebelum Fase 4d, tambahkan lewat SQLModel +
  ALTER manual, lalu introspect ulang.
