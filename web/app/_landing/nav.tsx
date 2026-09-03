import Link from "next/link";

/**
 * One line, well under the 80px ceiling. Just the wordmark and the single
 * honest call to action this page gets: Masuk. No Dashboard / Rak / Riwayat
 * links here, those pages are behind the login this nav points at.
 */
export function LandingNav() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-6">
        <span className="font-display text-sm font-medium tracking-wide text-ink">
          Coffee Ledger
        </span>
        <Link
          href="/login"
          className="font-body text-sm text-ink-dim transition-colors hover:text-ink"
        >
          Masuk
        </Link>
      </div>
    </header>
  );
}
