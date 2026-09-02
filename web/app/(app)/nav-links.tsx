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
    <nav className="flex items-center gap-6 font-body text-sm">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "text-amber"
                : "text-ink-dim transition-colors hover:text-ink"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
