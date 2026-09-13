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
