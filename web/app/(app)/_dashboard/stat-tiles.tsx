import { formatGrams } from "@/lib/format";

/**
 * Total stok memimpin sebagai kartu utama -- itu angka yang paling sering
 * dibutuhkan untuk keputusan harian. Lot aktif dan total lot ikut tampil
 * sebagai dua angka sekunder berdampingan, bukan tiga kartu setara: dulu
 * ketiganya berbobot sama walau total lot jarang jadi acuan keputusan, dan
 * di layar sempit itu menghabiskan ruang sebelum grafik stok mulai kelihatan.
 * Selalu tampil, termasuk saat semuanya nol -- itu keadaan yang sah, bukan error.
 *
 * Lepas dari bingkai kartu (border/panel) sengaja: angka besar sudah
 * membawa hierarki sendiri lewat ukuran font, jadi bingkai di sini cuma
 * kebisingan berulang. Garis bawah tunggal di seluruh grup tetap menjaga
 * ketiganya kebaca sebagai satu kelompok tanpa bingkai per-angka.
 */
export function StatTiles({
  total,
  active,
  all,
}: {
  total: number;
  active: number;
  all: number;
}) {
  return (
    <section className="grid grid-cols-2 gap-4 border-b border-line pb-6 sm:grid-cols-[2fr_1fr_1fr] sm:gap-6">
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          Total stok
        </p>
        <p className="mt-2 font-display text-3xl font-light tabular-nums text-ink">
          {formatGrams(total)}
        </p>
      </div>
      <SecondaryStat label="Lot aktif" value={String(active)} />
      <SecondaryStat label="Total lot" value={String(all)} />
    </section>
  );
}

function SecondaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-light tabular-nums text-ink">
        {value}
      </p>
    </div>
  );
}
