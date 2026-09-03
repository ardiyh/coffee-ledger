import Link from "next/link";
import { Reveal } from "./reveal";

const STACK = [
  "Next.js",
  "React",
  "Drizzle",
  "Neon Postgres",
  "Auth.js",
  "Tailwind",
] as const;

/**
 * Closing section: what it's built with, where the code lives, and one
 * more Masuk link. Stays a plain horizontal band, no fifth repeat of a
 * text-and-box shape, it should read like a footer because it is one.
 */
export function StackLinks() {
  return (
    <section className="mx-auto max-w-[1100px] px-6 py-20 sm:py-24">
      <Reveal className="flex flex-col gap-8 border-t border-line pt-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-medium text-ink">
            Stack yang dipakai
          </h2>
          <div className="flex flex-wrap gap-2">
            {STACK.map((item) => (
              <span
                key={item}
                className="rounded-full border border-line bg-panel-2 px-3 py-1 font-mono text-xs text-ink-dim"
              >
                {item}
              </span>
            ))}
          </div>
          <p className="font-body text-sm text-ink-faint">
            Kode sumbernya bisa dibaca di GitHub.
          </p>
          <a
            href="https://github.com/ardiyh/coffee-ledger"
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-sm text-amber transition-colors hover:text-amber-dim"
          >
            Lihat repo di GitHub
          </a>
        </div>

        <Link
          href="/login"
          className="inline-flex h-11 items-center self-start rounded-full bg-amber px-6 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-dim"
        >
          Masuk
        </Link>
      </Reveal>
    </section>
  );
}
