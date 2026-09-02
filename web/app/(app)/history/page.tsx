import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { history, listLots } from "@/lib/ledger/service";
import { formatGrams, formatWIB } from "@/lib/format";
import type { TxnReason } from "@/lib/ledger/repository";

const REASON_LABELS: Record<TxnReason, string> = {
  ACQUIRE: "Masuk / beli",
  BREW: "Seduh",
  GIFT: "Kasih orang",
  ADJUST: "Koreksi",
};

export default async function HistoryPage() {
  // Real auth boundary for this page — see lib/session.ts for why the
  // (app) layout's redirect isn't enough on its own.
  await requireSession();

  const [txns, lots] = await Promise.all([history(db), listLots(db)]);
  const lotNames = new Map(lots.map((l) => [l.id, l.name]));
  // service.history() returns rows in chronological (oldest-first) order;
  // this page wants newest first.
  const sorted = [...txns].sort((a, b) => b.ts.getTime() - a.ts.getTime());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-medium text-ink">Riwayat</h1>
        <a
          href="/history/csv"
          className="rounded-full border border-line px-4 py-2 font-body text-sm text-ink transition-colors hover:border-amber hover:text-amber"
        >
          Unduh CSV
        </a>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-line bg-panel p-10 text-center">
          <p className="font-body text-sm text-ink-dim">
            Belum ada transaksi.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full border-collapse font-body text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                  Waktu
                </th>
                <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                  Lot
                </th>
                <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                  Alasan
                </th>
                <th className="px-4 py-3 text-right font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                  Gram
                </th>
                <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                  Catatan
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                // Sign is the primary encoding, colour reinforces it. Never
                // colour by reason — ADJUST goes both ways, so that would lie.
                const isIn = t.kind === "IN";
                return (
                  <tr
                    key={t.id}
                    className="border-b border-line last:border-0"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-ink-dim">
                      {formatWIB(t.ts)}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {lotNames.get(t.lotId) ?? `Lot ${t.lotId}`}
                    </td>
                    <td className="px-4 py-3 text-ink-dim">
                      {REASON_LABELS[t.reason]}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums ${
                        isIn ? "text-teal" : "text-clay"
                      }`}
                    >
                      {isIn ? "+" : "−"}
                      {formatGrams(t.grams)}
                    </td>
                    <td className="px-4 py-3 text-ink-dim">
                      {t.note ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
