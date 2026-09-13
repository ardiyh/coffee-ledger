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
