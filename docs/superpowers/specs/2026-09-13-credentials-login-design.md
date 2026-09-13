# Login email + password sebagai alternatif Google OAuth

**Tanggal:** 2026-09-13
**Status:** Disetujui, siap masuk rencana implementasi

## 1. Konteks

`/login` sekarang cuma punya satu jalur masuk: Google OAuth, digerbangi satu email lewat
`AUTH_ALLOWED_EMAIL` (`web/auth.ts`). Pemilik projek mau tambahan jalur **email + password
biasa**, berdampingan dengan Google — bukan gantiin.

Ini bersinggungan dengan keputusan arsitektur yang sudah ada:

> "JWT sessions only — no database adapter... a database adapter would create
> users/sessions/accounts tables and break that arrangement." — komentar di `auth.ts`, awalnya
> ditulis karena Neon dipakai bareng Streamlit yang memiliki schema.

Streamlit sudah pensiun dan Drizzle sudah jadi pemilik schema sepenuhnya, jadi alasan asli
("DB dipakai bareng, jangan sentuh schema-nya") sudah gak berlaku. Tapi prinsip **"nol tabel
baru buat satu pemilik akun"** tetap dipertahankan di desain ini — bukan karena keharusan
teknis lama, tapi karena app ini tetap single-user dan menambah tabel `users`/`credentials`
buat menyimpan satu baris data adalah kerja ekstra tanpa manfaat nyata.

## 2. Lingkup

**Termasuk:**
- Provider `Credentials` di Auth.js, additive terhadap `Google` yang sudah ada.
- Password disimpan sebagai hash `scrypt` (Node built-in `crypto`, nol dependency baru) di
  env var `AUTH_PASSWORD_HASH`.
- Script lokal buat generate hash dari password baru.
- Form email+password di `/login`, di bawah tombol Google yang sudah ada.

**Tidak termasuk (lihat §9 buat alasannya):**
- Multi-user / registrasi akun baru.
- Reset password lewat email (magic link, dsb).
- Rate limiting / lockout setelah percobaan gagal.
- 2FA.
- Mengganti atau menghapus Google OAuth.

## 3. Hashing password

File baru `web/lib/auth/password.ts`:

```ts
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

/** Format tersimpan: "<saltHex>:<hashHex>". */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Gagal aman: format yang gak dikenal, atau panjang buffer yang gak cocok
 * (jadi timingSafeEqual gak akan dipanggil dengan panjang beda -- itu
 * melempar, bukan mengembalikan false), keduanya dianggap password salah.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [saltHex, hashHex] = parts;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, KEY_LENGTH);

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
```

Script lokal baru `web/scripts/hash-password.mjs` (plain Node, bukan TypeScript — dijalankan
langsung lewat `node`, jadi gak butuh ts-node/tsx sebagai dependency baru cuma buat satu
skrip sekali-jalan). Ia mengimplementasikan ulang logic `hashPassword` di atas secara mandiri
(bukan import dari `web/lib/auth/password.ts`, karena itu perlu dicompile TS-nya dulu). Ini
duplikasi ~10 baris yang disengaja, dicatat sebagai risiko di §10.

```bash
node scripts/hash-password.mjs "password-baru"
# cetak: <saltHex>:<hashHex>  -- salin ke AUTH_PASSWORD_HASH
```

## 4. `web/auth.ts`

Tambah provider `Credentials`:

```ts
import Credentials from "next-auth/providers/credentials";
import { verifyPassword } from "./lib/auth/password";

// ...

Credentials({
  credentials: { email: {}, password: {} },
  async authorize(creds) {
    const email = String(creds.email ?? "").trim().toLowerCase();
    const password = String(creds.password ?? "");
    const hash = process.env.AUTH_PASSWORD_HASH;

    if (!email || !password || !allowedEmail || !hash) return null;
    if (email !== allowedEmail.toLowerCase()) return null;
    if (!verifyPassword(password, hash)) return null;

    return { email };
  },
}),
```

`signIn` callback yang ada sekarang baca `profile?.email`/`profile?.email_verified` — field itu
cuma ada buat provider OAuth (Google). Sign-in lewat Credentials datang sebagai `user` (hasil
`authorize()`), bukan `profile`. Callback perlu bercabang per provider:

```ts
async signIn({ profile, user, account }) {
  if (!allowedEmail) return false;

  if (account?.provider === "credentials") {
    // authorize() sudah memvalidasi password; ini pemeriksaan kedua (defense
    // in depth), bukan yang pertama.
    return user?.email?.toLowerCase() === allowedEmail.toLowerCase();
  }

  const email = profile?.email;
  const emailVerified = profile?.email_verified;
  if (!email || !emailVerified) return false;
  return email.toLowerCase() === allowedEmail.toLowerCase();
},
```

## 5. UI — `/login`

`web/app/login/page.tsx` tetap Server Component. Di bawah tombol "Masuk dengan Google" yang
ada sekarang, tambah pemisah "atau" lalu form email+password lewat komponen client baru.

File baru `web/app/login/actions.ts`:

```ts
"use server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export interface CredentialsActionState {
  error?: string;
}

export async function credentialsSignInAction(
  _prevState: CredentialsActionState,
  formData: FormData,
): Promise<CredentialsActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (err) {
    // signIn() sukses melempar sinyal redirect Next.js (bukan AuthError) --
    // itu HARUS dilempar ulang, bukan ditangkap, atau navigasinya gak jalan.
    if (err instanceof AuthError) {
      return { error: "Email atau password salah." };
    }
    throw err;
  }
  return {};
}
```

File baru `web/app/login/credentials-form.tsx` (`"use client"`), pola `useActionState` yang
sama seperti form lain di app ini (`AddLotForm`, dst.): input email, input password
(`type="password"`), tombol submit, `state.error` dirender lewat `role="alert"`.

## 6. Testing

File baru `web/lib/auth/password.test.ts` (Vitest, node environment — tidak butuh PGlite/jsdom
karena ini fungsi murni tanpa DB atau DOM):

- Password benar lolos verifikasi.
- Password salah gagal.
- String tersimpan yang formatnya rusak (bukan `salt:hash`, atau salah satu bagian bukan hex
  valid) gagal, bukan melempar error.

Tidak ada test untuk `authorize()`/`signIn` callback itu sendiri — sejalan dengan konvensi yang
ada di repo ini, `auth.ts` dan Server Action lain (`addLotAction`, dst.) diverifikasi lewat
`tsc --noEmit` dan pengecekan manual di browser, bukan test otomatis, karena keduanya
memerlukan konteks request Next.js yang gak dites di lapisan ini.

## 7. Tradeoff keamanan

Ditulis apa adanya, bukan disembunyikan di balik kode:

- **Gak ada 2FA, gak ada deteksi anomali/breach** yang otomatis didapat dari Google OAuth.
  Satu password yang harus diingat dan dijaga sendiri.
- **Gak ada rate limiting / lockout** pada percobaan login gagal. `scrypt` bikin brute-force
  mahal secara komputasi (beda dengan SHA-256 polos), tapi itu satu-satunya lapisan
  pertahanan di luar kerahasiaan password itu sendiri.
- Diterima untuk app single-owner ini, sebagai pertukaran sadar demi kenyamanan alternatif
  login saat Google OAuth gak bisa dipakai. Bukan keputusan yang otomatis benar buat app
  multi-user.

## 8. Alur environment variable

`web/.env.example` dapat dua baris baru:

```
AUTH_PASSWORD_HASH=
```

(`AUTH_ALLOWED_EMAIL` sudah ada, dipakai bareng oleh kedua provider.) `web/README.md` perlu
sebaris instruksi: generate hash lewat `node scripts/hash-password.mjs "<password>"`, isi
`AUTH_PASSWORD_HASH` di `.env.local` (dev) dan Vercel env (produksi).

## 9. Bukan bagian dari pekerjaan ini

- **Multi-user / registrasi** — app ini satu pemilik; menambah alur signup gak sejalan dengan
  `AUTH_ALLOWED_EMAIL` yang jadi gerbang tunggal.
- **Reset password via email** — butuh layanan pengirim email (Resend/SMTP) dan penyimpanan
  token sementara, dua moving part baru buat fitur yang jarang dipakai di app single-user;
  kalau lupa password, generate hash baru lewat script dan update env var manual sudah cukup.
- **Rate limiting/lockout** — lihat §7; dicatat sebagai tradeoff sadar, bukan diabaikan diam-diam.
- **2FA buat jalur Credentials** — di luar lingkup; kalau keamanan tambahan dibutuhkan, jalur
  Google (yang sudah punya 2FA lewat akun Google-nya sendiri) tetap ada dan dianjurkan.
- **Mengganti Google OAuth** — kedua jalur tetap ada berdampingan, permanen, bukan sementara.

## 10. Risiko & hal terbuka

- **Duplikasi logic hash antara `web/lib/auth/password.ts` dan
  `web/scripts/hash-password.mjs`.** Kalau format `salt:hash` atau parameter `scrypt` berubah
  di satu tempat, tempat lain harus diubah manual — gak ada test yang menjamin keduanya tetap
  sinkron. Diterima karena skrip ini cuma dipanggil manual sesekali (setup awal / ganti
  password), bukan bagian dari jalur eksekusi app.
- **`AUTH_PASSWORD_HASH` kosong/tidak diset** ditangani sebagai "gagal login" (lihat `authorize()`
  di §4: `!hash` menolak), bukan error yang mematikan app — konsisten dengan pola env var
  opsional yang sudah ada di codebase ini.
- **Ganti password butuh redeploy** (env var baru, bukan tulis-DB). Diterima sebagai
  konsekuensi dari keputusan "nol tabel baru" di §1 — ganti password memang jarang terjadi.
