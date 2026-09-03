import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-ground px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-panel p-8 text-center">
        <h1 className="font-display text-2xl font-medium text-ink">
          Coffee Ledger
        </h1>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Access is limited to the owner&apos;s Google account.
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
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-amber px-5 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-dim"
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
