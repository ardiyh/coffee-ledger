"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

export function NavLinks({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi utama" className="col-span-2 row-start-2 flex flex-wrap items-center gap-x-2 gap-y-2 font-body text-sm">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            // -my-3 cancels py-3 for layout purposes: the tap target grows to
            // ~44px without pushing neighboring rows around it.
            className={`-my-3 rounded-full px-3 py-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${
              active
                ? "bg-panel-2 text-amber"
                : "text-ink-dim hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
