import { Fragment } from "react";
import { daysSince, formatGrams } from "@/lib/format";

/**
 * Bar stok per lot, urut menurun, satu hue amber — bar mengodekan besaran,
 * bukan identitas lot, jadi tidak ada warna per lot di sini.
 *
 * Baris kedua kecil di bawah nama lot menampilkan umur roast sebagai angka
 * plus label, bukan lampu lalu lintas: skalanya kontinu dan ambang "lewat
 * masa prima" itu selera, jadi warna status merah/kuning/hijau akan
 * berbohong soal presisi yang sebenarnya tidak ada.
 */
export function StockBars({
  rows,
}: {
  rows: { name: string; stock: number; roastDate: string }[];
}) {
  const sorted = [...rows].sort((a, b) => b.stock - a.stock);
  const maxStock = sorted[0]?.stock ?? 0;

  return (
    <section className="rounded-lg border border-line bg-panel p-6">
      <h2 className="mb-6 font-display text-base font-medium text-ink">
        Stok per lot
      </h2>
      {/*
        Label column sizes to its content (max-content) so long lot names
        are never truncated. There is no visible track: bars are sorted and
        every value is printed, so a track behind them carries no
        information and only gives the label something to collide with.
        Bars sit directly on the panel background, and the value is a
        sibling positioned just past the bar's own — dynamic — width, with
        a small gap, so it always trails the tip rather than sitting on it.
      */}
      <div className="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-3">
        {sorted.map((r) => {
          const pct = maxStock > 0 ? (r.stock / maxStock) * 100 : 0;
          const age = daysSince(r.roastDate);
          const pastPrime = age > 30;
          return (
            <Fragment key={r.name}>
              <div>
                <span className="whitespace-nowrap font-body text-sm text-ink">
                  {r.name}
                </span>
                <p className="mt-1 whitespace-nowrap font-body text-xs text-ink-faint">
                  {age} hari sejak roast
                  {pastPrime ? " · lewat masa prima" : ""}
                </p>
              </div>
              <div
                className="flex h-2 items-center"
                style={{ width: "calc(100% - 6rem)" }}
              >
                <div
                  className="h-2 shrink-0 rounded-r-[4px] bg-amber"
                  style={{ width: `${pct}%` }}
                />
                <span className="pl-2 font-mono text-sm tabular-nums whitespace-nowrap text-ink-dim">
                  {formatGrams(r.stock)}
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
