/**
 * Teal and clay are the whole page's one exception to the single-accent
 * rule: they're the subject here, not decoration. Two panels, not three
 * equal cards, and a different shape again (color blocks instead of
 * an image or an equation).
 */
export function ColorDecision() {
  return (
    <section className="mx-auto max-w-[1100px] px-6 py-16">
      <div className="flex flex-col gap-5">
        <h2 className="font-display text-2xl font-medium text-ink sm:text-3xl">
          Satu keputusan desain, dengan angka di baliknya.
        </h2>
        <p className="max-w-[640px] font-body text-base text-ink-dim">
          Warna IN dan OUT semula hijau dan merah bata. Simulasi buta warna
          deuteranopia menunjukkan hijau itu lolos cuma karena jauh lebih
          terang dari clay. Begitu terangnya dikoreksi supaya bacaannya
          setara, ΔE-nya jatuh ke 2,5, praktis tidak terbedakan
          buat sebagian penglihatan. Warnanya diganti jadi teal dan clay,
          ΔE naik ke 15,1. Bandingkan sendiri pasangannya di bawah.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-6">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            Sebelum, deuteranopia ΔE 2,5
          </p>
          <div className="mt-4 flex overflow-hidden rounded-md border border-line">
            <div className="h-16 flex-1" style={{ backgroundColor: "#689651" }} />
            <div className="h-16 flex-1" style={{ backgroundColor: "#B5654A" }} />
          </div>
          <p className="mt-3 font-body text-xs text-ink-faint">
            Hijau dan clay, pasangan yang diuji waktu itu. Di bawah
            simulasi deuteranopia, keduanya nyaris melebur jadi satu warna.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-panel p-6">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            Sesudah, deuteranopia ΔE 15,1
          </p>
          <div className="mt-4 flex overflow-hidden rounded-md border border-line">
            <div className="h-16 flex-1 bg-teal" />
            <div className="h-16 flex-1 bg-clay" />
          </div>
          <p className="mt-3 font-body text-xs text-ink-faint">
            Teal dan clay, warna IN dan OUT yang dipakai di seluruh app
            sekarang. Terpisah jelas walau di bawah simulasi yang sama.
          </p>
        </div>
      </div>
    </section>
  );
}
