import { formatGrams } from "@/lib/format";
import { BarRow } from "./bar-row";

const MAX_ROWS = 8;

/**
 * Siapa yang dapat kopimu, urut menurun. Satu hue amber, sama seperti bar
 * lain di dashboard ini — warna mengodekan besaran, bukan siapa orangnya.
 */
export function Recipients({
  rows,
}: {
  rows: { recipient: string; grams: number }[];
}) {
  const shown = rows.slice(0, MAX_ROWS);
  const rest = rows.slice(MAX_ROWS);
  const max = rows[0]?.grams ?? 0;

  function renderRow(r: { recipient: string; grams: number }) {
    const pct = max > 0 ? (r.grams / max) * 100 : 0;
    return (
      <BarRow key={r.recipient} label={r.recipient}
        percent={pct} value={formatGrams(r.grams)} />
    );
  }

  return (
    <section className="rounded-lg border border-line bg-panel p-6">
      <h2 className="font-display text-base font-medium text-ink">
        Siapa yang dapat kopimu
      </h2>
      <p className="mb-6 mt-1 font-body text-xs text-ink-faint">
        Dikelompokkan dari catatan transaksi hadiah
      </p>
      <div className="space-y-4">{shown.map(renderRow)}</div>
      {rest.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer font-body text-xs text-ink-dim hover:text-ink">
            Lihat semua penerima
          </summary>
          <div className="mt-4 space-y-4">{rest.map(renderRow)}</div>
        </details>
      ) : null}
    </section>
  );
}
