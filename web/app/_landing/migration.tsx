import Image from "next/image";
import { Reveal } from "./reveal";

/**
 * Mirror of the hero: screenshot on the left, text on the right. Same two
 * ingredients as the hero and the ledger-idea section, opposite
 * orientation, which is enough on its own to break the left-text pattern
 * this page would otherwise repeat three times in a row.
 */
export function Migration() {
  return (
    <section className="mx-auto max-w-[1100px] px-6 py-24 sm:py-32">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <Reveal className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-panel">
          <Image
            src="/app-rak.png"
            alt="Halaman Rak Coffee Ledger: baris lot dengan form catat transaksi langsung di baris"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover object-top"
          />
        </Reveal>
        <Reveal delayMs={80} className="flex flex-col gap-5">
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
        </Reveal>
      </div>
    </section>
  );
}
