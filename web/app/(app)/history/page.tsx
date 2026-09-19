import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { history, listLots } from "@/lib/ledger/service";
import { HistoryList, type HistoryLotOption, type HistoryTxnItem } from "./history-list";

export const metadata: Metadata = {
  title: "Riwayat — Coffee Ledger",
};

/**
 * `?lot=ID` on the receipt banner's "Lihat riwayat" link (see
 * rak/lot-list.tsx) should preselect that lot's filter here. Only a
 * positive, finite integer counts as a valid id -- anything else (missing,
 * non-numeric, negative, a `?lot=1&lot=2` array from a repeated param) is
 * ignored safely rather than thrown, since this is a soft UX nicety, not a
 * page that should ever error over its own query string.
 */
function parseLotId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string") return null;
  const n = Number(raw);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Real auth boundary for this page — see lib/session.ts for why the
  // (app) layout's redirect isn't enough on its own.
  await requireSession();

  // Next 16: searchParams is a Promise, must be awaited before reading it.
  const params = await searchParams;
  const initialLotId = parseLotId(params.lot);

  const [txns, lots] = await Promise.all([history(db), listLots(db)]);

  const lotOptions: HistoryLotOption[] = lots.map((l) => ({ id: l.id, name: l.name }));
  // Serialize `ts` to an ISO string at this server -> client boundary --
  // HistoryList is a client component and only ever needs a plain,
  // serializable prop shape, never a `Date` instance.
  const transactions: HistoryTxnItem[] = txns.map((t) => ({
    id: t.id,
    lotId: t.lotId,
    ts: t.ts.toISOString(),
    kind: t.kind,
    reason: t.reason,
    grams: t.grams,
    note: t.note,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-medium text-ink">Riwayat</h1>
        <a
          href="/history/csv"
          className="rounded-full border border-line px-4 py-2 font-body text-sm text-ink transition-colors hover:border-amber hover:text-amber"
        >
          Unduh semua CSV
        </a>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-lg border border-line bg-panel p-10 text-center">
          <p className="font-body text-sm text-ink-dim">
            Belum ada transaksi.
          </p>
        </div>
      ) : (
        <HistoryList transactions={transactions} lots={lotOptions} initialLotId={initialLotId} />
      )}
    </div>
  );
}
