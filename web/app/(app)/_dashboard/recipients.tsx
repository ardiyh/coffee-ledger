import { Fragment } from "react";
import { formatGrams } from "@/lib/format";

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
      <div className="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-3">
        {shown.map((r) => {
          const pct = max > 0 ? (r.grams / max) * 100 : 0;
          return (
            <Fragment key={r.recipient}>
              <span className="whitespace-nowrap font-body text-sm text-ink">
                {r.recipient}
              </span>
              <div
                className="flex h-2 items-center"
                style={{ width: "calc(100% - 6rem)" }}
              >
                <div
                  className="h-2 shrink-0 rounded-r-[4px] bg-amber"
                  style={{ width: `${pct}%` }}
                />
                <span className="pl-2 font-mono text-sm tabular-nums whitespace-nowrap text-ink-dim">
                  {formatGrams(r.grams)}
                </span>
              </div>
            </Fragment>
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
