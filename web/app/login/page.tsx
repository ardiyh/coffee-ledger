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
