import { Reveal } from "./reveal";

/**
 * Teal and clay are the whole page's one exception to the single-accent
 * rule: they're the subject here, not decoration. This is meant to be the
 * page's strongest moment, so it runs wider than the other sections and
 * the two panels are an asymmetric pair rather than two equal boxes: the
 * shipped colors get the larger half.
 */
export function ColorDecision() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
      <div className="mx-auto flex max-w-[760px] flex-col gap-5 text-center">
        <Reveal>
          <h2 className="font-display text-3xl font-medium text-ink sm:text-4xl">
            Satu keputusan desain, dengan angka di baliknya.
          </h2>
        </Reveal>
        <Reveal delayMs={80}>
          <p className="mx-auto font-body text-base text-ink-dim sm:text-lg">
            Warna IN dan OUT semula hijau dan merah bata. Simulasi buta warna
            deuteranopia menunjukkan hijau itu lolos cuma karena jauh lebih
            terang dari clay. Begitu terangnya dikoreksi supaya bacaannya
            setara, ΔE-nya jatuh ke 2,5, praktis tidak terbedakan buat
            sebagian penglihatan. Warnanya diganti jadi teal dan clay, ΔE
            naik ke 15,1. Bandingkan sendiri pasangannya di bawah.
          </p>
        </Reveal>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch">
        <Reveal
          delayMs={160}
          className="rounded-lg border border-line bg-panel p-8 sm:p-10"
        >
          <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            Sebelum, deuteranopia ΔE 2,5
          </p>
          <div className="mt-5 flex overflow-hidden rounded-md border border-line">
            <div
              className="h-24 flex-1 sm:h-28"
              style={{ backgroundColor: "#689651" }}
            />
            <div
              className="h-24 flex-1 sm:h-28"
              style={{ backgroundColor: "#B5654A" }}
            />
          </div>
          <p className="mt-4 font-body text-sm text-ink-faint">
            Hijau dan clay, pasangan yang diuji waktu itu. Di bawah simulasi
            deuteranopia, keduanya nyaris melebur jadi satu warna.
          </p>
        </Reveal>

        <Reveal
          delayMs={240}
          className="rounded-lg border border-line bg-panel p-8 sm:p-12"
        >
          <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            Sesudah, deuteranopia ΔE 15,1
          </p>
          <div className="mt-5 flex overflow-hidden rounded-md border border-line">
            <div className="h-28 flex-1 bg-teal sm:h-36" />
            <div className="h-28 flex-1 bg-clay sm:h-36" />
          </div>
          <p className="mt-4 font-body text-sm text-ink-dim">
            Teal dan clay, warna IN dan OUT yang dipakai di seluruh app
            sekarang. Terpisah jelas walau di bawah simulasi yang sama.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
