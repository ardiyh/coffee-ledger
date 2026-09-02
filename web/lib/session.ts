import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * The actual auth boundary for this app — not the `(app)` layout.
 *
 * Per the Next.js authentication guide ("Layouts and auth checks"): layouts
 * don't re-render on client-side navigation (Partial Rendering), so a check
 * placed only in a layout won't re-run on every route change, and a layout
 * doesn't control whether the rest of the route renders anyway. The check has
 * to sit close to the data source.
 *
 * So every page under `(app)` and every Server Action calls this directly,
 * even though `(app)/layout.tsx` also redirects unauthenticated visitors as a
 * UX convenience (avoids a flash of protected UI before the page-level check
 * runs).
 */
export async function requireSession() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return session;
}
