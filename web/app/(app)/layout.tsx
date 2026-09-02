import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { requireSession } from "@/lib/session";
import { NavLinks, type NavItem } from "./nav-links";

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/lots", label: "Lots" },
  { href: "/record", label: "Catat" },
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
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
          <span className="font-display text-lg font-medium text-ink">
            Coffee Ledger
          </span>
          <NavLinks items={NAV_ITEMS} />
          <form
            action={async () => {
              "use server";
              await requireSession();
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="font-body text-sm text-ink-dim transition-colors hover:text-ink"
            >
              Keluar
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
      </main>
    </div>
  );
}
