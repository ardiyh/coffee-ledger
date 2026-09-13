# Credentials Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email+password login as an alternative to Google OAuth on `/login`, without adding any new database table.

**Architecture:** A new Auth.js `Credentials` provider sits alongside the existing `Google` provider in `web/auth.ts`. The password is never stored in the database — it's a `scrypt` hash (Node's built-in `crypto`, no new dependency) kept in a single env var, `AUTH_PASSWORD_HASH`, checked against the same `AUTH_ALLOWED_EMAIL` allowlist Google already uses. The login page gets a second form below the Google button, following this codebase's existing `useActionState`/`ActionState` pattern used by every other form.

**Tech Stack:** Next.js 16 App Router, Auth.js v5 (`next-auth`), Node.js built-in `crypto`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-13-credentials-login-design.md`

---

### Task 1: Password hashing utility

**Files:**
- Create: `web/lib/auth/password.ts`
- Test: `web/lib/auth/password.test.ts`

- [x] **Step 1: Write the failing test**

Create `web/lib/auth/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("password yang benar lolos verifikasi", () => {
    const stored = hashPassword("kopi-enak-123");
    expect(verifyPassword("kopi-enak-123", stored)).toBe(true);
  });

  it("password yang salah gagal", () => {
    const stored = hashPassword("kopi-enak-123");
    expect(verifyPassword("password-salah", stored)).toBe(false);
  });

  it("format tersimpan yang bukan salt:hash gagal, bukan melempar", () => {
    expect(verifyPassword("apa saja", "bukan-format-yang-benar")).toBe(false);
    expect(verifyPassword("apa saja", "")).toBe(false);
    expect(verifyPassword("apa saja", "satu:dua:tiga")).toBe(false);
  });

  it("salt/hash yang bukan hex valid gagal, bukan melempar", () => {
    expect(verifyPassword("apa saja", "bukan-hex:juga-bukan-hex")).toBe(false);
  });

  it("dua hash dari password yang sama tidak identik (salt acak)", () => {
    const a = hashPassword("sama-sama");
    const b = hashPassword("sama-sama");
    expect(a).not.toBe(b);
    expect(verifyPassword("sama-sama", a)).toBe(true);
    expect(verifyPassword("sama-sama", b)).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run (from `web/`): `npm test -- --run -t "hashPassword / verifyPassword"`
Expected: FAIL — `Cannot find module './password'` (the file doesn't exist yet).

- [x] **Step 3: Write minimal implementation**

Create `web/lib/auth/password.ts`:

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

- [x] **Step 4: Run test to verify it passes**

Run (from `web/`): `npm test -- --run`
Expected: all tests pass, including the 5 new ones in `password.test.ts` (test count goes up
by 5 from wherever it currently stands).

- [x] **Step 5: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/lib/auth/password.ts web/lib/auth/password.test.ts
git commit -m "$(cat <<'EOF'
feat: hashPassword/verifyPassword pakai scrypt bawaan Node

Nol dependency baru -- node:crypto scrypt + timingSafeEqual. Format
tersimpan "saltHex:hashHex". Input rusak (format salah, hex gak
valid) gagal aman lewat pengecekan panjang buffer sebelum
timingSafeEqual, bukan lewat try/catch.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 2: Local hash-generation script

No automated test — this is a one-time local developer tool, run manually, never imported by
the app itself.

**Files:**
- Create: `web/scripts/hash-password.mjs`

- [x] **Step 1: Write the script**

Create `web/scripts/hash-password.mjs`:

```js
#!/usr/bin/env node
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Pakai: node scripts/hash-password.mjs "password-baru"');
  process.exit(1);
}

const KEY_LENGTH = 64;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, KEY_LENGTH);

console.log(`${salt.toString("hex")}:${hash.toString("hex")}`);
```

This deliberately reimplements the same ~10 lines from `web/lib/auth/password.ts` rather than
importing it — the script runs directly via `node` (plain JS), and importing a `.ts` file from
a `.mjs` script would need a TypeScript loader that isn't otherwise a dependency of this
project. If the hash format in `password.ts` ever changes, this script must be updated to
match by hand — noted as a known risk in the spec (§10), not something to solve here.

- [x] **Step 2: Run it and verify the output shape**

Run (from `web/`): `node scripts/hash-password.mjs "test-password-123"`
Expected: prints one line matching `<64 hex chars>:<128 hex chars>` (16-byte salt = 32 hex
chars... verify by running it — salt is `randomBytes(16)` = 32 hex chars, hash is 64 bytes =
128 hex chars, so the full line is 32 hex chars, a colon, then 128 hex chars).

Run it a second time with the same password and confirm the output is **different** both times
(random salt each run) — this is the same property Task 1's "dua hash... tidak identik" test
already covers for the underlying function, just eyeballed here for the script itself.

- [x] **Step 3: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/scripts/hash-password.mjs
git commit -m "$(cat <<'EOF'
feat: skrip lokal buat generate AUTH_PASSWORD_HASH

node scripts/hash-password.mjs "password" -> salt:hash buat ditempel
ke env var. Standalone (bukan import dari lib/auth/password.ts) biar
gak butuh loader TypeScript cuma buat satu skrip sekali-jalan.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 3: `Credentials` provider in `web/auth.ts`

No automated test for this task — `web/auth.ts` is a Next.js/Auth.js configuration file that
needs a real request context to exercise; it's verified through `npx tsc --noEmit` here, and
through the manual browser check in Task 7.

**Files:**
- Modify: `web/auth.ts`

- [x] **Step 1: Replace the file contents**

The current file is:

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowedEmail = process.env.AUTH_ALLOWED_EMAIL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: {
    // One owner, JWT sessions, no auth tables. Drizzle owns the ledger schema;
    // Python connects read-only for analysis.
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ profile }) {
      if (!allowedEmail) return false;

      const email = profile?.email;
      const emailVerified = profile?.email_verified;

      if (!email || !emailVerified) return false;

      return email.toLowerCase() === allowedEmail.toLowerCase();
    },
  },
});
```

Replace the whole file with:

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { verifyPassword } from "./lib/auth/password";

const allowedEmail = process.env.AUTH_ALLOWED_EMAIL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
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
  ],
  session: {
    // One owner, JWT sessions, no auth tables. Drizzle owns the ledger schema;
    // Python connects read-only for analysis.
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ profile, user, account }) {
      if (!allowedEmail) return false;

      if (account?.provider === "credentials") {
        // authorize() sudah memvalidasi email+password; ini pemeriksaan
        // kedua (defense in depth), bukan yang pertama.
        return user?.email?.toLowerCase() === allowedEmail.toLowerCase();
      }

      const email = profile?.email;
      const emailVerified = profile?.email_verified;

      if (!email || !emailVerified) return false;

      return email.toLowerCase() === allowedEmail.toLowerCase();
    },
  },
});
```

- [x] **Step 2: Type-check**

Run (from `web/`): `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 3: Run the full test suite (regression check)**

Run (from `web/`): `npm test -- --run`
Expected: all tests still pass (this task doesn't touch anything the test suite covers directly
— `password.ts` from Task 1 isn't re-tested here, just consumed).

- [x] **Step 4: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/auth.ts
git commit -m "$(cat <<'EOF'
feat: Credentials provider di auth.ts, berdampingan sama Google

authorize() cek email lawan AUTH_ALLOWED_EMAIL dan password lawan
hash di AUTH_PASSWORD_HASH. signIn callback bercabang per provider --
Credentials datang sebagai user (bukan profile kayak OAuth), jadi
gak punya field email_verified buat dicek.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 4: Server Action — `credentialsSignInAction`

No automated test — same reasoning as every other Server Action in this codebase (`addLotAction`,
`editLotAction`, etc.): verified via `tsc --noEmit` plus the manual browser check in Task 7.

**Files:**
- Create: `web/app/login/actions.ts`

- [x] **Step 1: Write the action**

Create `web/app/login/actions.ts`:

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
    // signIn() on success throws Next.js's internal redirect signal, not an
    // AuthError -- that MUST be rethrown, not swallowed here, or the
    // navigation to /dashboard never happens.
    if (err instanceof AuthError) {
      return { error: "Email atau password salah." };
    }
    throw err;
  }
  return {};
}
```

- [x] **Step 2: Type-check**

Run (from `web/`): `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 3: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/app/login/actions.ts
git commit -m "$(cat <<'EOF'
feat: credentialsSignInAction — Server Action buat login email+password

Pola ActionState yang sama seperti Server Action lain di app ini.
Menangkap AuthError jadi pesan generik "Email atau password salah",
melempar ulang error lain -- termasuk sinyal redirect Next.js yang
dilempar signIn() saat sukses.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 5: `CredentialsForm` component

**Files:**
- Create: `web/app/login/credentials-form.tsx`

- [x] **Step 1: Write the component**

Create `web/app/login/credentials-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { credentialsSignInAction, type CredentialsActionState } from "./actions";

const initialActionState: CredentialsActionState = {};

const inputClass =
  "w-full rounded-md border border-line bg-panel-2 px-3 py-2 font-body text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

export function CredentialsForm() {
  const [state, formAction, pending] = useActionState(
    credentialsSignInAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="mt-4 text-left">
      <fieldset disabled={pending} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center rounded-full border border-line font-body text-sm font-semibold text-ink transition-colors hover:border-amber hover:text-amber disabled:opacity-50"
        >
          {pending ? "Memeriksa..." : "Masuk"}
        </button>
        {state.error ? (
          <p className="font-body text-sm text-clay-ink" role="alert">
            {state.error}
          </p>
        ) : null}
      </fieldset>
    </form>
  );
}
```

- [x] **Step 2: Type-check and lint**

Run (from `web/`): `npx tsc --noEmit && npx eslint "app/login/credentials-form.tsx"`
Expected: no errors. (Not imported anywhere yet — that's Task 6 — so this only confirms it
compiles cleanly on its own.)

- [x] **Step 3: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/app/login/credentials-form.tsx
git commit -m "$(cat <<'EOF'
feat: komponen CredentialsForm

Form email+password, pola useActionState yang sama seperti
AddLotForm/EditLotForm di web/app/(app)/rak/. Belum dipasang ke
halaman login -- itu di task berikutnya.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 6: Wire `CredentialsForm` into `/login`

**Files:**
- Modify: `web/app/login/page.tsx`

- [x] **Step 1: Replace the file contents**

The current file is:

```tsx
import Link from "next/link";
import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-ground px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-panel p-8 text-center">
        <h1 className="font-display text-2xl font-medium text-ink">
          Coffee Ledger
        </h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Akses dibatasi untuk akun Google pemilik.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            // / sekarang landing publik, jadi setelah masuk arahkan ke app-nya.
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-amber px-5 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-hover"
          >
            Masuk dengan Google
          </button>
        </form>
      </div>
      <Link
        href="/"
        className="font-body text-sm text-ink-faint transition-colors hover:text-ink"
      >
        ← Kembali ke beranda
      </Link>
    </div>
  );
}
```

Replace the whole file with:

```tsx
import Link from "next/link";
import { signIn } from "@/auth";
import { CredentialsForm } from "./credentials-form";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-ground px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-panel p-8 text-center">
        <h1 className="font-display text-2xl font-medium text-ink">
          Coffee Ledger
        </h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Akses dibatasi untuk akun Google pemilik.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            // / sekarang landing publik, jadi setelah masuk arahkan ke app-nya.
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-amber px-5 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-hover"
          >
            Masuk dengan Google
          </button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="font-body text-xs text-ink-faint">atau</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <CredentialsForm />
      </div>
      <Link
        href="/"
        className="font-body text-sm text-ink-faint transition-colors hover:text-ink"
      >
        ← Kembali ke beranda
      </Link>
    </div>
  );
}
```

- [x] **Step 2: Type-check, lint, and run the full test suite**

Run (from `web/`):

```bash
npx tsc --noEmit
npx eslint .
npm test -- --run
```

Expected: no type errors, no eslint errors, all tests pass (this task doesn't add or remove any
Vitest tests, only UI wiring).

- [x] **Step 3: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/app/login/page.tsx
git commit -m "$(cat <<'EOF'
feat: pasang CredentialsForm di /login, di bawah tombol Google

Pemisah "atau" di antara dua jalur masuk. Keduanya berdampingan
permanen -- bukan Credentials menggantikan Google.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 7: Env var docs

**Files:**
- Modify: `web/.env.example`
- Modify: `web/README.md`

- [x] **Step 1: Add `AUTH_PASSWORD_HASH` to `web/.env.example`**

Current file:

```
# Salin ke web/.env.local. Jangan gunakan database produksi untuk eksperimen.
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
# Buat nilai acak lokal: openssl rand -base64 32
AUTH_SECRET=
# Google OAuth: redirect URI lokal http://localhost:3000/api/auth/callback/google
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_ALLOWED_EMAIL=
```

Append two lines at the end:

```
# Opsional -- alternatif login selain Google. Generate lewat:
# node scripts/hash-password.mjs "password-baru"
AUTH_PASSWORD_HASH=
```

- [x] **Step 2: Add a bullet to `web/README.md`**

In `web/README.md`, find this line (currently line 22):

```
- `AUTH_ALLOWED_EMAIL`: satu email pemilik yang diizinkan masuk.
```

Add a new bullet immediately after it:

```
- `AUTH_ALLOWED_EMAIL`: satu email pemilik yang diizinkan masuk.
- `AUTH_PASSWORD_HASH` (opsional): alternatif login email+password selain Google. Generate
  lewat `node scripts/hash-password.mjs "password-baru"`, salin hasilnya ke sini.
```

- [x] **Step 3: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/.env.example web/README.md
git commit -m "$(cat <<'EOF'
docs: catat AUTH_PASSWORD_HASH di .env.example dan README

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 8: Manual verification in the browser

No code changes — a gate before calling the feature done. This app's `/login` is gated by real
env vars (`AUTH_ALLOWED_EMAIL`, `AUTH_PASSWORD_HASH`), so it needs a human running through it.

- [ ] **Step 1: Generate a test password hash and set env vars**

Run (from `web/`): `node scripts/hash-password.mjs "a-real-test-password"`

Copy the printed `salt:hash` value into `AUTH_PASSWORD_HASH` in `web/.env.local`. Confirm
`AUTH_ALLOWED_EMAIL` in the same file is set to an email address you can type in (it doesn't
need to be a real inbox — Credentials login never sends mail, it only compares strings).

- [ ] **Step 2: Start the dev server**

Run (from `web/`): `npm run dev`
Expected: server starts on `http://localhost:3000` with no errors in the terminal.

- [ ] **Step 3: Exercise the Credentials login flow**

In a browser, go to `/login`.

- Confirm the page shows the Google button, an "atau" divider, then an email+password form.
- Type the `AUTH_ALLOWED_EMAIL` address and a **wrong** password, submit. Confirm an error
  message "Email atau password salah." appears and you're still on `/login`.
- Type the correct email and the password you hashed in Step 1, submit. Confirm you land on
  `/dashboard` and the app's normal `requireSession()`-gated pages are reachable.
- Sign out (the "Keluar" button in the app header), confirm you're returned to `/login`.
- Confirm the Google button still works as before (this task shouldn't have changed that path
  at all).

- [ ] **Step 4: Report result**

If everything above matches, the feature is done — no commit needed for this task. If
something doesn't match, note exactly what's wrong and fix it as a small follow-up commit
before considering the plan complete.
