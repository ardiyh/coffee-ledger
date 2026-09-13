import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { verifyPassword } from "./lib/auth/password";

const allowedEmail = process.env.AUTH_ALLOWED_EMAIL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    Credentials({
      credentials: { email: {}, password: { type: "password" } },
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
