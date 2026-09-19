import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { requireSession } from "@/lib/session";
import { NavLinks, type NavItem } from "./nav-links";

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/rak", label: "Rak" },
  { href: "/history", label: "Riwayat" },
];

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  // This redirect is a UX convenience (skip rendering the shell for a
  // visitor we already know is signed out) — it is NOT the auth boundary.
  // Because of Partial Rendering, this layout doesn't re-render on
  // client-side navigation between (app) routes, so a check here alone would
  // not be re-checked on every route change. The real boundary is
  // requireSession(), called in every page and every Server Action.
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-10 focus:rounded-md focus:bg-panel focus:px-4 focus:py-3 focus:text-ink focus:outline-2 focus:outline-amber">
        Lewati ke konten
      </a>
      <header className="border-b border-line bg-panel">
        <div className="mx-auto grid max-w-[960px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 sm:flex sm:justify-between sm:gap-6 sm:px-6">
          <span className="font-display text-lg font-medium text-ink">
            Coffee Ledger
          </span>
          <NavLinks items={NAV_ITEMS} />
          <form
            className="col-start-2 row-start-1"
            action={async () => {
              "use server";
              await requireSession();
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="-my-3 -mr-3 rounded-full px-3 py-3 font-body text-sm text-ink-dim transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
            >
              Keluar
            </button>
          </form>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="mx-auto max-w-[960px] px-4 py-10 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
