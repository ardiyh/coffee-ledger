import Image from "next/image";
import Link from "next/link";

/**
 * Heading is two lines at most, the supporting sentence stays under 20
 * words, and the Masuk link sits right under both, so the whole hero
 * resolves inside the first screen without scrolling.
 */
export function Hero() {
  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-10 px-6 pt-14 pb-16 lg:flex-row lg:items-center lg:gap-12 lg:pt-20">
      <div className="flex flex-col gap-6 lg:w-[46%]">
        <h1 className="font-display text-4xl leading-tight font-light text-ink sm:text-5xl">
          Stok dihitung dari riwayatnya, bukan disimpan.
        </h1>
        <p className="font-body text-base text-ink-dim">
          Proyek belajar pribadi. Awalnya Streamlit di Python, sekarang
          Next.js, mencatat tiap gram kopi yang masuk dan keluar dari rak.
        </p>
        <div>
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-full bg-amber px-6 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-dim"
          >
            Masuk
          </Link>
        </div>
      </div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-panel lg:w-[54%]">
        <Image
          src="/app-dashboard.png"
          alt="Dashboard Coffee Ledger: total stok, bar per lot, dan peta asal lot aktif"
          fill
          priority
          sizes="(min-width: 1024px) 54vw, 100vw"
          className="object-cover object-top"
        />
      </div>
    </section>
  );
}
