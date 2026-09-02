import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowedEmail = process.env.AUTH_ALLOWED_EMAIL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: {
    // JWT sessions only — no database adapter. The Neon database is shared
    // with a live Python app that owns the schema; a database adapter would
    // create users/sessions/accounts tables and break that arrangement.
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
