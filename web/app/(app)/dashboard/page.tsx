import Link from "next/link";
import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { stockSummary, outflowByReason, giftsByRecipient } from "@/lib/ledger/service";
import { StatTiles } from "../_dashboard/stat-tiles";
import { StockBars } from "../_dashboard/stock-bars";
import { Outflow } from "../_dashboard/outflow";
import { Recipients } from "../_dashboard/recipients";
import { OriginMap } from "../_dashboard/origin-map";

export default async function DashboardPage() {
  // Real auth boundary for this page — see lib/session.ts for why the
  // (app) layout's redirect isn't enough on its own.
  await requireSession();

  const [lots, outflow, gifts] = await Promise.all([
    stockSummary(db),
    outflowByReason(db),
    giftsByRecipient(db),
  ]);

  const totalStock = lots.reduce((sum, l) => sum + l.stock, 0);
  const activeLots = lots.filter((l) => l.stock > 0);
  const totalLots = lots.length;

  return (
    <div className="flex flex-col gap-10">
      <StatTiles
        total={totalStock}
        active={activeLots.length}
        all={totalLots}
      />

      {activeLots.length > 0 ? (
        <>
          <StockBars
            rows={activeLots.map((l) => ({
              name: l.lot.name,
              stock: l.stock,
              roastDate: l.lot.roastDate,
            }))}
          />
          <OriginMap
            lots={activeLots.map((l) => ({
              name: l.lot.name,
              stock: l.stock,
              origin: l.lot.origin,
            }))}
          />
        </>
      ) : (
        <div className="rounded-lg border border-line bg-panel p-10 text-center">
          <p className="font-display text-lg font-medium text-ink">
            Belum ada stok aktif
          </p>
          <p className="mt-2 font-body text-sm text-ink-dim">
            Tambah lot dan isi stok awalnya di Rak.
          </p>
          <Link
            href="/rak"
            className="mt-6 inline-block rounded-full bg-amber px-5 py-2 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-dim"
          >
            Ke Rak
          </Link>
        </div>
      )}

      {/*
        These two panels stay visible even at zero stock: they describe the
        past (what has already left, and who received it), not the current
        stock level, so an empty shelf doesn't erase them.
      */}
      {outflow.length > 0 ? <Outflow rows={outflow} /> : null}
      {gifts.length > 0 ? <Recipients rows={gifts} /> : null}
    </div>
  );
}
