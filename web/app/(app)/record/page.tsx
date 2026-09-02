import Link from "next/link";
import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { stockSummary } from "@/lib/ledger/service";
import { formatGrams } from "@/lib/format";
import { RecordForm, type LotOption } from "./record-form";

export default async function RecordPage() {
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
          Tambahkan lot dulu di halaman{" "}
          <Link
            href="/lots"
            className="text-amber underline underline-offset-2"
          >
            Lots
          </Link>{" "}
          sebelum mencatat transaksi.
        </p>
      </div>
    );
  }

  const lotOptions: LotOption[] = lots.map(({ lot, stock }) => ({
    id: lot.id,
    name: lot.name,
    stockLabel: formatGrams(stock),
  }));

  return (
    <div className="flex flex-col gap-10">
      <section className="rounded-lg border border-line bg-panel p-6">
        <h2 className="mb-6 font-display text-base font-medium text-ink">
          Catat transaksi
        </h2>
        <RecordForm lots={lotOptions} />
      </section>
    </div>
  );
}
