import { daysSince, formatGrams } from "@/lib/format";
import { BarRow } from "./bar-row";

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
  rows: { id: number; name: string; stock: number; roastDate: string }[];
}) {
  const sorted = [...rows].sort((a, b) => b.stock - a.stock);
  const maxStock = sorted[0]?.stock ?? 0;

  return (
    <section className="rounded-lg border border-line bg-panel p-6">
      <h2 className="mb-6 font-display text-base font-medium text-ink">
        Stok per lot
      </h2>
      <div className="space-y-4">
        {sorted.map((r) => {
          const pct = maxStock > 0 ? (r.stock / maxStock) * 100 : 0;
          const age = daysSince(r.roastDate);
          const pastPrime = age > 30;
          return (
            <BarRow key={r.id} percent={pct} value={formatGrams(r.stock)} label={
              <>
                <span>{r.name}</span>
                <p className="mt-1 font-body text-xs text-ink-faint">
                  {age} hari sejak roast
                  {pastPrime ? " · lewat masa prima" : ""}
                </p>
              </>
            } />
          );
        })}
      </div>
    </section>
  );
}
