import { Fragment } from "react";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { stockSummary } from "@/lib/ledger/service";
import { formatGrams } from "@/lib/format";

export default async function DashboardPage() {
  // Real auth boundary for this page — see lib/session.ts for why the
  // (app) layout's redirect isn't enough on its own.
  await requireSession();

  const lots = await stockSummary(db);

  if (lots.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-panel p-10 text-center">
        <p className="font-display text-lg font-medium text-ink">
          Belum ada lot.
        </p>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Tambahkan lot pertama di halaman{" "}
          <Link
            href="/lots"
            className="text-amber underline underline-offset-2"
          >
            Lots
          </Link>
          .
        </p>
      </div>
    );
  }

  const totalStock = lots.reduce((sum, l) => sum + l.stock, 0);
  const activeLots = lots.filter((l) => l.stock > 0).length;
  const totalLots = lots.length;

  // Rule 7: sort bars by stock descending.
  const sorted = [...lots].sort((a, b) => b.stock - a.stock);
  const maxStock = sorted[0]?.stock ?? 0;

  return (
    <div className="flex flex-col gap-10">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total stok" value={formatGrams(totalStock)} />
        <StatTile label="Lot aktif" value={String(activeLots)} />
        <StatTile label="Total lot" value={String(totalLots)} />
      </section>

      <section className="rounded-lg border border-line bg-panel p-6">
        <h2 className="mb-6 font-display text-base font-medium text-ink">
          Stok per lot
        </h2>
        {/*
          Label column sizes to its content (max-content) so long lot names
          are never truncated. The bar column reserves space at its right
          edge for the value, and the value itself is a child of the amber
          fill (positioned at left:100% of the fill's own — dynamic — width),
          so it always trails the actual tip of the bar rather than sitting
          in a fixed column far past a short bar.
        */}
        <div className="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-[2px]">
          {sorted.map((l) => {
            const pct = maxStock > 0 ? (l.stock / maxStock) * 100 : 0;
            return (
              <Fragment key={l.lot.id}>
                <span className="whitespace-nowrap font-body text-sm text-ink">
                  {l.lot.name}
                </span>
                <div
                  className="h-2 bg-panel-2"
                  style={{ width: "calc(100% - 6rem)" }}
                >
                  <div
                    className="relative h-2 rounded-r-[4px] bg-amber"
                    style={{ width: `${pct}%` }}
                  >
                    <span className="absolute top-1/2 left-full -translate-y-1/2 pl-2 font-mono text-sm tabular-nums whitespace-nowrap text-ink-dim">
                      {formatGrams(l.stock)}
                    </span>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </section>
    </div>
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
