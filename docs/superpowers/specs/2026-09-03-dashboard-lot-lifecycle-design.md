# Dashboard yang berisi, siklus hidup lot, dan pensiunnya Streamlit

**Tanggal:** 2026-09-03
**Status:** Disetujui, siap masuk rencana implementasi
**Lanjutan dari:** `2026-09-03-coffee-ledger-nextjs-design.md`

## 1. Konteks

App Next.js sudah setara Streamlit: empat halaman, di balik login Google, membaca dan
menulis ke Neon. Yang berubah hari ini dan memicu spec ini:

1. **Stok sekarang nol.** Kopi di dunia nyata sudah habis, tapi buku besar masih mencatat
   450 g. Sudah dikoreksi lewat dua transaksi ADJUST OUT (bukan dihapus), jadi riwayat utuh
   dan angka jujur. Konsekuensinya: **tampilan keadaan-kosong sekarang jadi tampilan
   pertama yang dilihat**, bukan kasus langka.
2. **Streamlit dipensiunkan.** Ini mencabut aturan "Drizzle cuma introspect" yang mengunci
   schema sepanjang fase sebelumnya.
3. Dashboard terasa kosong dan datanya kurang dimanfaatkan.

## 2. Apa yang sebenarnya ada di data

Diperiksa langsung dari Neon sebelum merancang, supaya fiturnya punya bahan:

```
transaksi          : 16, semuanya tercatat pada satu hari (28 Jun) + 4 koreksi
aliran keluar      : GIFT 1210 g (70,3%) · ADJUST 451 g (26,2%) · BREW 60 g (3,5%)
penerima hadiah    : Hapis 430 · Mas Gunt 315 · Grey 265 · Rama 100 · Adem 100
umur roast         : 76-77 hari (jauh lewat masa prima 7-30 hari)
origin             : "Kerinci, Jambi" · "Rantekarua, South Sulawesi"
```

Tiga kesimpulan yang membentuk desain ini:

- **Belum ada deret waktu.** Semua transaksi di satu hari. Grafik konsumsi mingguan akan
  menampilkan satu paku. Ditunda sampai app dipakai harian.
- **Catatan GIFT berisi nama orang.** Dimensi berharga yang tersembunyi di teks bebas.
- **`origin` sudah berisi region nyata**, jadi peta tidak butuh kolom baru.

## 3. Arah visual

**Design read:** dashboard inventaris pribadi untuk pemiliknya sendiri, bahasa visual
dark warm-minimalist, condong ke Tailwind v4 + Geist + gerak nyaris nol.

**Dial:** `DESIGN_VARIANCE 5` · `MOTION_INTENSITY 3` · `VISUAL_DENSITY 5`.
Ini alat yang dibaca sekilas tiap hari, bukan landing page. Alat yang beranimasi tiap dibuka
akan menyebalkan pada hari ketiga.

### Soal `taste-skill`

Skill itu menyatakan dirinya **tidak untuk dashboard** (bagiannya sendiri: *"This skill is
NOT for: Dashboards / dense product UI / admin panels"*). Bagian hero, CTA, logo wall,
marquee, dan variasi layout section tidak berlaku di sini dan tidak dipakai.

Yang diambil dan mengikat: larangan em-dash di seluruh teks tampilan, larangan titik
dekoratif dan eyebrow bernomor, larangan angka palsu-presisi, kunci satu warna aksen, kunci
satu skala radius, satu tema per halaman, `prefers-reduced-motion`, dan disiplin
empty/loading/error state.

### Ganti font display

**Fraunces dihapus, diganti Geist.** `taste-skill` menyebut Fraunces sebagai salah satu dari
dua serif default favorit LLM. Fraunces adalah pilihan asisten, bukan pilihan pemilik projek,
jadi tidak ada pembelaan brand untuknya.

Palet **tidak** ikut berubah: `#C8965A` berasal dari `.streamlit/config.toml` yang ditulis
pemilik projek sendiri, jadi ia warna brand yang sah, bukan default AI.

Tiga font jadi dua:

| Peran | Sebelum | Sesudah |
|---|---|---|
| Display | Fraunces | **Geist** (berat lebih tinggi) |
| Teks | Karla | **Geist** |
| Angka & label | IBM Plex Mono | **Geist Mono** |

Keduanya ada di Google Fonts dan dikenali `next/font` (terverifikasi 2026-09-03). Papan
identitas ikut diperbarui supaya kode dan brand tidak bercabang.

## 4. Pensiunkan Streamlit

- `app/app.py` dihapus. Deploy di Streamlit Cloud dimatikan.
- `src/coffee_ledger/` **tetap ada** beserta 23 test-nya, sebagai jalur baca Python untuk EDA
  Fase 5. `requirements.txt` dan `.streamlit/` ikut dihapus karena khusus Streamlit.
- **Drizzle mengambil alih kepemilikan schema.** Aturan "Drizzle cuma introspect" dari spec
  sebelumnya dicabut; mulai sekarang perubahan schema lewat `drizzle-kit generate` +
  `migrate` seperti biasa.
- Konsekuensi yang diterima: kalau kelak Drizzle menambah kolom, model SQLModel tidak
  mengetahuinya. Untuk membaca kolom lama, yang merupakan satu-satunya kebutuhan EDA, itu
  tidak bermasalah. Dicatat di README.

## 5. Siklus hidup lot

### 5a. Tambah lot sekaligus stok awal

Sekarang menambah lot berisi butuh dua langkah di dua halaman: buat lot di `/lots`, lalu
catat ACQUIRE di `/record`. Digabung: form tambah lot mendapat kolom **gram awal
(opsional)**. Kalau diisi, satu Server Action membuat lot lalu mencatat ACQUIRE untuk lot itu.

Kalau pencatatan ACQUIRE gagal setelah lot terbuat, lot tetap ada dengan stok nol dan
pesan errornya mengatakan demikian. Tidak ada rollback: membuat lot dan mencatat transaksi
adalah dua fakta terpisah di buku besar, dan lot berstok nol adalah keadaan yang sah.

### 5b. Tombol "Habiskan"

Di tiap baris lot pada `/lots`, hanya muncul saat stok > 0. Satu klik mencatat **ADJUST OUT
sebesar sisa stok**, catatan otomatis `habis`. Stok jadi nol; lot hilang dari dashboard dan
peta; riwayat utuh.

**Bukan menghapus lot.** Stok dihitung dari transaksi, jadi menghapus transaksi berarti
mengarang ulang sejarah dan merusak justru properti yang membuat desain ini benar.

Karena ini penulisan yang tidak bisa dibatalkan dengan satu klik lagi, tombolnya meminta
konfirmasi yang menyebut jumlah gramnya.

### 5c. Pilihan region saat menambah lot

Kolom origin mendapat daftar region kopi Indonesia yang dikenal (`<datalist>`, jadi ketik
bebas tetap boleh). Ini mempercepat input **dan** memberi koordinat untuk peta tanpa kolom
baru.

## 6. Dashboard

Empat tambahan, semuanya memakai data yang sudah ada.

### 6a. Umur roast

Per lot aktif: jumlah hari sejak `roast_date`. Penanda halus setelah 30 hari. Tidak memakai
warna status merah/kuning/hijau: skalanya kontinu dan ambangnya selera, jadi angka plus
label lebih jujur daripada lampu lalu lintas.

### 6b. Ke mana kopimu pergi

Tiga baris berlabel: GIFT, BREW, ADJUST, dengan gram dan persentase.

**Hanya menghitung transaksi OUT.** ACQUIRE tidak boleh masuk grafik yang sama: yang masuk
dan yang keluar bukan bagian dari satu keseluruhan, dan mencampurnya akan berbohong.

Bentuknya tiga baris satu warna amber, bukan stacked bar. Alasannya bukan selera: stacked bar
butuh tiga warna kategoris yang harus lolos uji buta warna, dan trio amber-teal-clay gagal
pada pasangan amber/clay (ΔE 12,9, di bawah ambang 15 untuk penglihatan normal).

Angka ADJUST punya makna tambahan yang layak ditampilkan apa adanya: ia mengukur seberapa
sering buku besar tidak diperbarui saat kopinya dipakai.

### 6c. Siapa yang dapat kopimu

Transaksi GIFT dikelompokkan berdasarkan catatannya, dijumlahkan, diurutkan menurun. Bar
horizontal satu warna, tiap bar dilabeli langsung.

Pengelompokan memangkas spasi dan mengabaikan besar-kecil huruf. Catatan kosong masuk
kelompok "tanpa catatan". Ini heuristik atas teks bebas dan akan salah kalau nama ditulis
berbeda-beda; kalau nanti berantakan, itu sinyal bahwa penerima layak jadi kolom sendiri,
bukan alasan menambah kolom sekarang.

### 6d. Peta asal lot aktif

- Tabel statis di kode: region kopi Indonesia → koordinat (Gayo, Kerinci, Toraja,
  Rantekarua, Kintamani, Bajawa, Preanger, Wamena, Mandailing, dan lainnya).
- `origin` tiap lot dicocokkan ke tabel itu. **Tidak ada kolom baru.**
- **SVG inline**, bukan library peta: outline Indonesia sederhana, titik untuk tiap lot
  aktif, ukuran titik mengikuti stok. Tanpa tile server, tanpa API key, dan warnanya
  mengikuti palet gelap kita, yang tidak bisa dilakukan peta tile generik.
- **Hanya lot aktif.** Lot habis hilang dari peta tapi tetap ada di riwayat.
- Lot yang origin-nya tidak cocok dengan tabel cukup tidak muncul di peta, tanpa error, dan
  jumlahnya disebut kecil di bawah peta supaya tidak terasa ada yang hilang diam-diam.

Peta ini **hiburan dan latihan geospasial, bukan alat.** Untuk 2-5 lot ia tidak memberi tahu
apa pun yang tidak sudah diketahui dari membaca nama origin-nya. Dicatat apa adanya supaya
pilihan ini sadar.

## 7. Keadaan kosong

Karena stok nol, inilah tampilan yang dilihat pertama sampai lot baru masuk. Ia harus
tersusun rapi, bukan sekadar kosong:

- Kartu angka tetap tampil dengan nilai nol, tidak disembunyikan.
- Panel stok, peta, dan "ke mana kopimu pergi" digantikan satu ajakan yang mengarah ke
  `/lots`.
- "Siapa yang dapat kopimu" tetap tampil kalau ada riwayat GIFT, karena ia bicara tentang
  masa lalu, bukan stok sekarang.

## 7b. Pemecahan menjadi dua rencana

Ruang lingkup ini terlalu besar untuk satu rencana implementasi, dan dua bagiannya bisa
berdiri sendiri:

| Rencana | Isi | Selesai kalau |
|---|---|---|
| **A** | Pensiunkan Streamlit, ganti font, §5a-5c (siklus hidup lot) | Bisa menambah lot berisi dalam satu langkah, dan menghabiskan lot dengan satu klik |
| **B** | §6a-6d (isi dashboard) + §7 (keadaan kosong) | Dashboard menampilkan umur roast, aliran keluar, penerima, dan peta |

A didahulukan, karena keluhan nyatanya adalah mengisi lot baru itu melelahkan, dan karena
dashboard yang diperkaya di B hanya kelihatan setelah ada lot aktif untuk ditampilkan.

## 8. Bukan bagian dari pekerjaan ini

- Grafik apa pun yang berbasis deret waktu. Belum ada bahannya.
- Kolom `recipient` terpisah untuk penerima hadiah.
- Kolom lat/lon.
- Peta interaktif (zoom, pan, popup).
- Menghapus lot atau transaksi.
- Green bean dan rendemen roasting.
- Mengubah palet.

## 9. Risiko dan hal terbuka

- **Outline Indonesia perlu sumber.** Rencananya membundel topologi sederhana dari sumber
  domain publik (Natural Earth atau setara). Lisensi dan ukuran file harus diperiksa saat
  implementasi; kalau tidak ada yang layak, petanya ditunda dan sisa spec ini tetap jalan.
- **Pengelompokan penerima berbasis teks bebas** akan salah bila penulisan nama tidak
  konsisten. Diterima untuk sekarang.
- **Menghapus Streamlit tidak bisa dibatalkan dengan mudah** selain lewat riwayat git.
  Dilakukan setelah pemilik projek memakai app Next.js dan puas.

---

## Rencana selanjutnya (diputuskan 2026-09-03, belum ditulis rencananya)

Dua perubahan routing yang **harus ditulis dalam satu rencana**, karena keduanya menulis
ulang nav yang sama; mengerjakannya terpisah berarti menyentuh nav dua kali.

### D1. Halaman "Rak" — gabungan Lots + Catat

`/lots` dan `/record` jadi satu halaman bernama **Rak**. Nav turun jadi
**Dashboard · Rak · Riwayat**.

Bukan sekadar menempelkan dua form. Bentuknya: **daftar lot itu sendiri jadi antarmukanya** —
tiap baris menampilkan stoknya, dan pencatatan dilakukan di baris itu juga. Dropdown "pilih
lot" hilang, karena pengguna bertindak pada baris yang sedang dilihatnya.

Tambah lot turun jadi tindakan sekunder. Alasannya frekuensi: lot ditambah beberapa minggu
sekali, transaksi dicatat hampir tiap hari, jadi menaruh form tambah lot di atas form catat
adalah hierarki terbalik.

### D2. Landing page sebagai portofolio, bukan halaman produk

Halaman publik di `/`, dashboard pindah ke rute lain.

Penting: app ini punya allowlist **satu email**, jadi tidak ada yang bisa mendaftar. Landing
page bergaya produk ("coba gratis", "daftar sekarang") akan berbohong. Yang dibangun adalah
**portofolio**: menceritakan pola ledger di mana stok tidak pernah disimpan, perpindahan
Streamlit ke Next.js, dan kenapa palet IN/OUT harus lolos uji buta warna. Tombol Masuk cukup
di pojok.

`taste-skill` **tepat dipakai di sini**, kebalikan dari dashboard yang skill itu tolak
sendiri: landing page dan portofolio persis yang ia rancang.

**Urutan:** Rencana C dikerjakan lebih dulu. Menggabung Lots dan Catat berarti menulis ulang
form tambah lot, dan Rencana C juga menyentuh form yang sama; berurutan menghindari
menulisnya dua kali.
