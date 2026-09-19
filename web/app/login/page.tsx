import type { Metadata } from "next";
import Link from "next/link";
import { signIn } from "@/auth";
import { CredentialsForm } from "./credentials-form";

export const metadata: Metadata = {
  title: "Masuk — Coffee Ledger",
};

export default function LoginPage() {
  return (
    // `min-h-dvh` (not `flex-1` off the root layout's body, and not
    // `min-h-screen`) so this page's height is self-contained and uses the
    // *dynamic* viewport unit -- correct even when mobile browser chrome
    // (address bar, etc.) shrinks the visible area. `justify-center`
    // still centers the card on tall/normal viewports; on a short one
    // (e.g. a landscape phone) where content needs more room than that,
    // the box just grows past `min-h-dvh` and the page scrolls normally --
    // nothing here clips or hides content, it only ever adds vertical
    // padding/room, never a fixed/max height that could cut it off.
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ground px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-line bg-panel p-8 text-center">
        <h1 className="font-display text-2xl font-medium text-ink">
          Coffee Ledger
        </h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Akses dibatasi untuk pemilik saja.
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
    </main>
  );
}
