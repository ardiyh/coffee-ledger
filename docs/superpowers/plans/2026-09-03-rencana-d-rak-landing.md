# Rencana D — Halaman Rak & Landing Portofolio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lots dan Catat lebur jadi satu halaman bernama Rak di mana daftar lot itu sendiri jadi antarmukanya, dan `/` berubah dari dashboard jadi halaman portofolio publik.

**Architecture:** Dua perubahan routing dalam satu rencana, karena keduanya menulis ulang nav yang sama. Dikerjakan bertahap supaya app tetap jalan di setiap commit: pindahkan dashboard, bangun Rak berdampingan dengan halaman lama, tukar nav lalu hapus yang lama, terakhir ganti redirect `/` dengan landing.

**Tech Stack:** Next.js 16.3.4, React 19, Tailwind v4, Server Actions. Tidak ada dependensi baru.

**Spec:** `docs/superpowers/specs/2026-09-03-dashboard-lot-lifecycle-design.md` §"Rencana selanjutnya" (D1, D2)

---

## Keputusan yang sudah diambil

| Hal | Keputusan | Alasan |
|---|---|---|
| Rute | `/` landing publik; `/dashboard`, `/rak`, `/history` di balik login | Cuma dashboard yang pindah alamat. Landing diletakkan di luar route group `(app)` sehingga gerbang auth tidak menyentuhnya |
| Bentuk baris Rak | Form catat **selalu terlihat** di tiap baris, bukan yang harus diklik dulu | Dengan segelintir lot, buka-tutup menambah state dan klik tanpa imbalan |
| Aksi pada lot berstok nol | Tetap ditampilkan semua | Menyembunyikan "Seduh" berarti menyalin aturan stok ke UI. Aturan yang hidup di dua tempat suatu hari akan berbeda pendapat. Barisnya sudah menampilkan `0 g`, dan service menolak dengan pesan jelas |
| Isi landing | Portofolio, bukan halaman produk | Allowlist satu email: tidak ada yang bisa mendaftar, jadi CTA "daftar sekarang" akan berbohong |
| Gambar landing | Screenshot app yang asli | `taste-skill` melarang keras fake screenshot dari `<div>`, dan kita tidak perlu memalsukan apa pun |

## Struktur file

| File | Perubahan | Tanggung jawab |
|---|---|---|
| `web/app/(app)/dashboard/page.tsx` | Move | Dashboard, dari `(app)/page.tsx` |
| `web/app/(app)/rak/page.tsx` | Create | Daftar lot + catat inline + tambah lot |
| `web/app/(app)/rak/lot-row.tsx` | Create | Satu baris lot beserta form catatnya |
| `web/app/(app)/rak/add-lot-form.tsx` | Move | Dari `lots/add-lot-form.tsx` |
| `web/app/(app)/rak/finish-lot-button.tsx` | Move | Dari `lots/finish-lot-button.tsx` |
| `web/app/(app)/layout.tsx` | Modify | Nav jadi tiga item |
| `web/app/(app)/lots/`, `record/` | Delete | Lebur ke Rak |
| `web/app/page.tsx` | Create | Landing publik |
| `web/app/_landing/*.tsx` | Create | Bagian-bagian landing |
| `web/public/*.png` | Create | Screenshot app buat landing |

---

### Task 1: Pindahkan dashboard ke `/dashboard`

**Files:**
- Move: `web/app/(app)/page.tsx` → `web/app/(app)/dashboard/page.tsx`
- Create: `web/app/page.tsx` (sementara: redirect)
- Modify: `web/app/(app)/layout.tsx`

Dikerjakan lebih dulu dan sendirian supaya app tetap utuh: `/` masih mengantar ke dashboard, cuma lewat satu lompatan.

- [ ] **Step 1: Pindahkan filenya**

```bash
cd web && mkdir -p "app/(app)/dashboard" && git mv "app/(app)/page.tsx" "app/(app)/dashboard/page.tsx"
```

Sesuaikan impor relatif di dalamnya kalau ada yang menunjuk `./_dashboard/...` — sekarang harus `../_dashboard/...`.

- [ ] **Step 2: `/` sementara mengantar ke dashboard**

Buat `web/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

// Sementara. Diganti halaman portofolio di Task 5; ditaruh sekarang supaya
// app tetap utuh sepanjang rencana ini, bukan cuma di akhir.
export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 3: Nav menunjuk `/dashboard`**

Di `web/app/(app)/layout.tsx`, ubah item nav Dashboard dari `href: "/"` menjadi `href: "/dashboard"`.

- [ ] **Step 4: Verifikasi**

Run: `cd web && npx next typegen && npx tsc --noEmit && npx vitest run && npx next build`
Expected: bersih, `34 passed`, dan tabel rute memuat `/dashboard`.

Dengan dev server jalan, tanpa sesi:
`curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/dashboard` → `307` ke `/login`.

- [ ] **Step 5: Commit**

```bash
git add -A web/
git commit -m "refactor: dashboard pindah ke /dashboard

Nyiapin / buat landing publik. Buat sekarang / masih ngantar ke dashboard,
biar app tetep utuh di tiap commit, bukan cuma di akhir rencana.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 2: Halaman Rak

**Files:**
- Create: `web/app/(app)/rak/page.tsx`, `web/app/(app)/rak/lot-row.tsx`
- Move: `lots/add-lot-form.tsx` dan `lots/finish-lot-button.tsx` ke `rak/`

Dibangun **berdampingan** dengan `/lots` dan `/record` yang masih ada. Keduanya baru dihapus di Task 3, setelah Rak terbukti jalan.

Bentuknya: daftar lot **adalah** antarmukanya. Tidak ada dropdown "pilih lot", karena pengguna bertindak pada baris yang sedang dilihatnya.

- [ ] **Step 1: Pindahkan dua komponen yang dipakai ulang**

```bash
cd web && mkdir -p "app/(app)/rak"
git mv "app/(app)/lots/add-lot-form.tsx" "app/(app)/rak/add-lot-form.tsx"
git mv "app/(app)/lots/finish-lot-button.tsx" "app/(app)/rak/finish-lot-button.tsx"
```

Perbaiki impor `../actions` di keduanya kalau kedalamannya berubah (tidak berubah: sama-sama satu tingkat di bawah `(app)`).

`web/app/(app)/lots/page.tsx` masih mengimpornya; arahkan sementara ke lokasi baru supaya halaman lama tetap jalan sampai Task 3.

- [ ] **Step 2: Buat `lot-row.tsx`**

Client component. Props:

```tsx
{
  lotId: number;
  name: string;
  origin: string;
  varietal: string;
  processMethod: string | null;
  roastDate: string;
  stock: number;
}
```

Isi satu baris:

- Baris atas: nama lot (`text-ink`), lalu di bawahnya satu baris kecil `text-ink-faint` berisi `origin · varietal · processMethod ?? "proses tidak dicatat"` dan `{daysSince(roastDate)} hari sejak roast`.
- Kanan: stok besar (`font-mono tabular-nums`), plus `<FinishLotButton>` **hanya kalau stok > 0**.
- Baris bawah: form catat yang selalu terlihat, memakai `recordAction` yang sudah ada, dengan `useActionState` seperti komponen lain di app ini. Isinya: `<select name="kind">` (Masuk / beli, Seduh, Kasih orang, Koreksi naik, Koreksi turun), `<input name="grams" type="number" step="any">`, `<input name="note">` opsional, dan tombol Catat. `<input type="hidden" name="lotId">` membawa lotnya.

**Semua aksi tetap ditampilkan walau stok nol.** Menyembunyikan sebagian berarti menyalin aturan stok ke UI; `record()` di service sudah menolak dengan pesan yang jelas, dan barisnya sudah memperlihatkan `0 g`.

Tampilkan `state.error` di bawah form dengan `text-clay`, dan `state.success` dengan `text-teal`, mengikuti pola yang sudah dipakai `add-lot-form.tsx`.

- [ ] **Step 3: Buat `rak/page.tsx`**

Server Component. `await requireSession()` sebagai pernyataan pertama.

Ambil lewat `Promise.all`: `stockSummary(db)` dan `distinctLotValues(db)`. Gabungkan saran dengan daftar kurasi persis seperti yang sudah dilakukan `lots/page.tsx` sekarang.

Susunannya, **dan urutannya penting**:

1. Daftar lot lebih dulu, urut stok menurun lalu nama. Ini yang dipakai hampir tiap hari.
2. Tambah lot di bawahnya, di dalam `<details>` dengan `<summary>` berbunyi "Tambah lot baru". Tertutup secara bawaan.

Alasannya frekuensi: transaksi dicatat hampir tiap hari, lot ditambah beberapa minggu sekali. Menaruh form tambah lot di atas berarti hierarki terbalik.

Kalau belum ada lot sama sekali, jangan tampilkan daftar kosong; tampilkan ajakan singkat dan buka `<details>`-nya secara bawaan (`<details open>`).

- [ ] **Step 4: Verifikasi**

Run: `cd web && npx next typegen && npx tsc --noEmit && npx vitest run && npx next build`
Expected: bersih, `34 passed`, tabel rute memuat `/rak` **dan** masih memuat `/lots` serta `/record`.

- [ ] **Step 5: Commit**

```bash
git add -A web/
git commit -m "feat: halaman Rak — daftar lot jadi antarmukanya

Gak ada lagi dropdown 'pilih lot': tiap baris punya form catatnya sendiri,
jadi kamu bertindak di baris yang lagi kamu liat.

Tambah lot turun jadi <details> tertutup. Alasannya frekuensi: transaksi
dicatat hampir tiap hari, lot ditambah beberapa minggu sekali.

/lots sama /record masih idup; dihapus di commit berikutnya setelah Rak
kebukti jalan.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 3: Tukar nav, hapus halaman lama

**Files:**
- Modify: `web/app/(app)/layout.tsx`
- Delete: `web/app/(app)/lots/`, `web/app/(app)/record/`

- [ ] **Step 1: Nav jadi tiga item**

Di `web/app/(app)/layout.tsx`:

```tsx
const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/rak", label: "Rak" },
  { href: "/history", label: "Riwayat" },
] as const;
```

- [ ] **Step 2: Hapus halaman lama**

```bash
cd web && git rm -r "app/(app)/lots" "app/(app)/record"
```

- [ ] **Step 3: Pastikan tak ada rujukan tersisa**

Run: `cd web && grep -rn '"/lots"\|"/record"\|/lots\b' app lib --include=*.tsx --include=*.ts`
Expected: tidak ada hasil. Kalau ada (misalnya tautan di keadaan kosong dashboard), arahkan ke `/rak`.

- [ ] **Step 4: Verifikasi**

Run: `cd web && npx next typegen && npx tsc --noEmit && npx vitest run && npx next build`
Expected: bersih, `34 passed`, tabel rute **tidak lagi** memuat `/lots` atau `/record`.

- [ ] **Step 5: Commit**

```bash
git add -A web/
git commit -m "refactor: /lots sama /record dilebur ke /rak

Nav turun jadi tiga: Dashboard, Rak, Riwayat.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 4: Screenshot untuk landing

**Files:**
- Create: `web/public/app-dashboard.png`, `web/public/app-rak.png`

Landing butuh gambar sungguhan. `taste-skill` melarang keras membangun "screenshot palsu" dari `<div>`; kita tidak perlu, karena app-nya nyata dan bisa difoto.

- [ ] **Step 1: Ambil screenshot dari app yang berjalan**

Cetak cookie sesi seperti tugas sebelumnya di repo ini (`encode` dari `next-auth/jwt`, salt `authjs.session-token`, rahasia dari `../.env`), jalankan dev server, lalu dengan Playwright (`/Users/hilmi/anaconda3/bin/python`, viewport 1180x900, `device_scale_factor=2`) foto `/dashboard` dan `/rak`.

Simpan ke `web/public/app-dashboard.png` dan `web/public/app-rak.png`.

Database berisi satu lot (`Gayo Wine Natural`, 500 g), jadi keduanya akan memperlihatkan data nyata, bukan keadaan kosong.

- [ ] **Step 2: Lihat kedua gambar**

Buka keduanya dan pastikan layak dipamerkan: tidak terpotong, tidak ada overlay error dev, dashboard memperlihatkan bar dan peta.

- [ ] **Step 3: Periksa ukurannya**

Run: `ls -lh web/public/*.png`
Kalau ada yang di atas 500 KB, ambil ulang dengan `device_scale_factor=1`. Ini gambar landing page, bukan cetakan.

- [ ] **Step 4: Commit**

```bash
git add web/public
git commit -m "chore: screenshot app buat landing page

Gambar asli dari app yang jalan, bukan mockup. Datanya juga nyata.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

### Task 5: Landing portofolio di `/`

**Files:**
- Modify: `web/app/page.tsx` (ganti redirect dengan halaman sungguhan)
- Create: `web/app/_landing/*.tsx` sesuai kebutuhan

**Design read:** pameran projek milik seorang yang sedang belajar, untuk orang yang dikirimi tautannya. Bahasa visual gelap dan editorial, memakai token app sendiri.

**Dial:** `DESIGN_VARIANCE 6` · `MOTION_INTENSITY 3` · `VISUAL_DENSITY 3`. Ini bacaan, bukan situs agensi. Gerak rendah karena brand-nya tenang.

**Ini bukan halaman produk.** Allowlist satu email berarti tidak ada yang bisa mendaftar. Tidak boleh ada "coba gratis", "daftar sekarang", atau harga. Tombolnya cukup **Masuk** di pojok kanan atas, mengarah ke `/login`.

Aturan yang mengikat, dari `taste-skill`:

- **Nol em-dash di seluruh teks yang terlihat.** Pakai titik, koma, atau tanda hubung biasa. Ini gagal-mutlak, bukan preferensi.
- Maksimal **satu eyebrow per tiga bagian**. Dengan lima bagian, paling banyak dua eyebrow di seluruh halaman.
- Tidak ada eyebrow bernomor (`01 / INDEX`), tidak ada isyarat scroll, tidak ada titik dekoratif, tidak ada label versi.
- Hero muat dalam satu layar: judul maksimal dua baris, subteks maksimal 20 kata.
- Nav satu baris, tinggi maksimal 80px.
- Satu tema untuk seluruh halaman: gelap, sama seperti app. Tidak ada bagian yang membalik jadi terang.
- Satu warna aksen: amber. Jangan memperkenalkan warna baru.
- Tidak ada tiga kartu fitur yang sama besar berjejer. Variasikan bentuk antarbagian.
- Hormati `prefers-reduced-motion`.

Isi, lima bagian:

1. **Hero.** Judul singkat, satu kalimat penjelas, tombol Masuk, dan `app-dashboard.png` sebagai gambarnya. Gambar dimuat pakai `next/image` dengan `priority`.
2. **Ide ledger-nya.** Stok tidak pernah disimpan; ia hasil penjumlahan transaksi. Karena itu stok tidak bisa salah, riwayatnya gratis, dan membatalkan sesuatu dilakukan dengan mencatat koreksi, bukan menghapus baris.
3. **Perjalanannya.** Streamlit lalu Next.js. Sebutkan periode dua app berbagi satu database, dan kenapa timestamp harus dibereskan sebelum app kedua boleh menulis.
4. **Satu keputusan desain.** Palet IN/OUT semula hijau dan merah. Validator buta warna menunjukkan pada tingkat terang yang sama ΔE deuteranopia-nya cuma 1 sampai 6, praktis tidak terbedakan. Diganti teal, ΔE 15,1. Tampilkan kedua pasangan warnanya berdampingan supaya pembaca melihat sendiri.
5. **Stack dan tautan.** Daftar teknologinya, tautan ke repo GitHub (`https://github.com/ardiyh/coffee-ledger`), dan tombol Masuk sekali lagi.

Gunakan `app-rak.png` di bagian 2 atau 3, mana yang lebih pas.

- [ ] **Step 1: Tulis halamannya**

Ganti isi `web/app/page.tsx`. Pecah jadi komponen di `web/app/_landing/` kalau melebihi sekitar 150 baris; satu file besar sulit dibaca sekaligus.

Halaman ini **publik**: jangan memanggil `requireSession()` dan jangan menyentuh database.

- [ ] **Step 2: Verifikasi mekanis**

Run: `cd web && npx next typegen && npx tsc --noEmit && npx vitest run && npx next build`
Expected: bersih, `34 passed`. Di tabel rute, `/` harus **statis** (`○`), bukan dinamis, karena ia tidak membaca sesi maupun database.

- [ ] **Step 3: Periksa larangan em-dash secara mekanis**

Run: `cd web && grep -rn '—\|–' app/page.tsx app/_landing 2>/dev/null`
Expected: tidak ada hasil. Kalau ada, tulis ulang kalimatnya; jangan cuma ganti karakternya dengan yang mirip.

- [ ] **Step 4: Lihat dua keadaan**

Tanpa cookie sesi sama sekali:
- `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/` → `200`, bukan `307`. Ini yang membuktikan landing benar-benar publik.
- `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/dashboard` → `307` ke `/login`. Gerbang auth tetap utuh.

Dengan Playwright (viewport 1180x900, `device_scale_factor=2`), foto `/` penuh ke `.../scratchpad/landing.png`, **lihat gambarnya**, dan laporkan: apakah hero muat dalam satu layar, apakah ada teks bertumpuk, apakah gambarnya tajam, apakah ada bagian yang membalik jadi terang.

Foto juga pada lebar 390px dan laporkan apakah tata letaknya runtuh dengan benar jadi satu kolom.

- [ ] **Step 5: Hapus berkas sementara dan commit**

```bash
git add -A web/
git commit -m "feat: landing portofolio di /

Bukan halaman produk: allowlist satu email bikin CTA 'daftar sekarang'
jadi bohong. Isinya cerita projeknya — pola ledger, pindahan Streamlit ke
Next.js, dan kenapa palet IN/OUT diganti gara-gara uji buta warna.

Gambarnya screenshot app beneran, bukan mockup.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6"
```

---

## Definisi selesai

- [ ] `cd web && npx vitest run` → `34 passed`
- [ ] `uv run pytest` → `22 passed` (tidak tersentuh)
- [ ] `npx tsc --noEmit` bersih, `npx next build` sukses
- [ ] Rute: `/` statis dan publik; `/dashboard`, `/rak`, `/history` di balik login
- [ ] `/lots` dan `/record` tidak ada lagi, dan tidak ada rujukan tersisa
- [ ] Nav tiga item: Dashboard, Rak, Riwayat
- [ ] Rak: catat langsung di baris lot, tanpa dropdown pilih lot; tambah lot di `<details>` tertutup
- [ ] Landing: nol em-dash, satu tema gelap, gambar screenshot asli, tanpa CTA pendaftaran
- [ ] Tata letak landing runtuh benar di lebar 390px
