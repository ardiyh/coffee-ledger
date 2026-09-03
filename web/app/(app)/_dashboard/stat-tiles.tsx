import { formatGrams } from "@/lib/format";

/**
 * Tiga angka headline: total stok, lot aktif, total lot. Selalu tampil,
 * termasuk saat semuanya nol — itu keadaan yang sah, bukan error.
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
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatTile label="Total stok" value={formatGrams(total)} />
      <StatTile label="Lot aktif" value={String(active)} />
      <StatTile label="Total lot" value={String(all)} />
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-6">
      <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-light tabular-nums text-ink">
        {value}
      </p>
    </div>
  );
}
