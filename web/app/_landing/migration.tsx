import Image from "next/image";

/**
 * Image on the right at a narrower share than the hero's, text on the
 * left. Same ingredients as the ledger-idea section, different
 * proportions and an image instead of an equation panel, so the page
 * doesn't repeat a shape.
 */
export function Migration() {
  return (
    <section className="mx-auto max-w-[1100px] px-6 py-16">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div className="flex flex-col gap-5 lg:order-1">
          <h2 className="font-display text-2xl font-medium text-ink sm:text-3xl">
            Streamlit lebih dulu, baru Next.js.
          </h2>
          <p className="font-body text-base text-ink-dim">
            Aplikasi ini mulai sebagai skrip Streamlit di Python. Waktu
            ditulis ulang di Next.js, untuk sementara dua aplikasi itu
            berbagi satu database Neon yang sama, sampai yang baru
            benar-benar siap menggantikan yang lama.
          </p>
          <p className="font-body text-base text-ink-dim">
            Karena dua app menulis ke tabel yang sama, timestamp harus
            dibereskan lebih dulu: disimpan UTC, ditampilkan waktu
            Asia/Jakarta, baru app kedua diizinkan menulis. Kalau tidak,
            satu baris riwayat bisa terbaca beda jam tergantung app mana
            yang membacanya.
          </p>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-panel lg:order-2">
          <Image
            src="/app-rak.png"
            alt="Halaman Rak Coffee Ledger: baris lot dengan form catat transaksi langsung di baris"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover object-top"
          />
        </div>
      </div>
    </section>
  );
}
