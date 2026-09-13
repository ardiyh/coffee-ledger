import { formatGrams } from "@/lib/format";

/**
 * Total stok memimpin sebagai kartu utama -- itu angka yang paling sering
 * dibutuhkan untuk keputusan harian. Lot aktif dan total lot ikut tampil
 * sebagai dua angka sekunder berdampingan, bukan tiga kartu setara: dulu
 * ketiganya berbobot sama walau total lot jarang jadi acuan keputusan, dan
 * di layar sempit itu menghabiskan ruang sebelum grafik stok mulai kelihatan.
 * Selalu tampil, termasuk saat semuanya nol -- itu keadaan yang sah, bukan error.
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
    <section className="flex flex-col gap-4">
      <div className="rounded-lg border border-line bg-panel p-6">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          Total stok
        </p>
        <p className="mt-2 font-display text-3xl font-light tabular-nums text-ink">
          {formatGrams(total)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SecondaryStat label="Lot aktif" value={String(active)} />
        <SecondaryStat label="Total lot" value={String(all)} />
      </div>
    </section>
  );
}

function SecondaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-light tabular-nums text-ink">
        {value}
      </p>
    </div>
  );
}
