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
  const rest = rows.length - shown.length;
  const max = rows[0]?.grams ?? 0;

  return (
    <section className="rounded-lg border border-line bg-panel p-6">
      <h2 className="mb-6 font-display text-base font-medium text-ink">
        Siapa yang dapat kopimu
      </h2>
      <div className="space-y-4">
        {shown.map((r) => {
          const pct = max > 0 ? (r.grams / max) * 100 : 0;
          return (
            <BarRow key={r.recipient} label={r.recipient}
              percent={pct} value={formatGrams(r.grams)} />
          );
        })}
      </div>
      {rest > 0 ? (
        <p className="mt-3 font-body text-xs text-ink-faint">
          +{rest} penerima lain
        </p>
      ) : null}
    </section>
  );
}
