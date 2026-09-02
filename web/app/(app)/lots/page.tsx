import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { stockSummary } from "@/lib/ledger/service";
import { formatGrams } from "@/lib/format";
import { AddLotForm } from "./add-lot-form";

export default async function LotsPage() {
  // Real auth boundary for this page — see lib/session.ts for why the
  // (app) layout's redirect isn't enough on its own.
  await requireSession();

  const lots = await stockSummary(db);
  const todayISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-10">
      <section className="rounded-lg border border-line bg-panel p-6">
        <h2 className="mb-6 font-display text-base font-medium text-ink">
          Tambah lot
        </h2>
        <AddLotForm todayISO={todayISO} />
      </section>

      <section className="rounded-lg border border-line bg-panel p-6">
        <h2 className="mb-6 font-display text-base font-medium text-ink">
          Lot yang ada
        </h2>
        {lots.length === 0 ? (
          <p className="font-body text-sm text-ink-dim">Belum ada lot.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-body text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="py-2 pr-4 font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                    Nama
                  </th>
                  <th className="py-2 pr-4 font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                    Origin
                  </th>
                  <th className="py-2 pr-4 font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                    Varietal
                  </th>
                  <th className="py-2 pr-4 font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                    Roast
                  </th>
                  <th className="py-2 pl-4 text-right font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                    Stok
                  </th>
                </tr>
              </thead>
              <tbody>
                {lots.map(({ lot, stock }) => (
                  <tr key={lot.id} className="border-b border-line last:border-0">
                    <td className="py-3 pr-4 text-ink">{lot.name}</td>
                    <td className="py-3 pr-4 text-ink-dim">{lot.origin}</td>
                    <td className="py-3 pr-4 text-ink-dim">{lot.varietal}</td>
                    <td className="py-3 pr-4 font-mono text-ink-dim">
                      {lot.roastDate}
                    </td>
                    <td className="py-3 pl-4 text-right font-mono tabular-nums text-ink">
                      {formatGrams(stock)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
