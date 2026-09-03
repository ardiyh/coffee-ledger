import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { distinctLotValues, stockSummary } from "@/lib/ledger/service";
import { COFFEE_REGIONS } from "@/lib/regions";
import { VARIETALS, PROCESS_METHODS } from "@/lib/coffee-vocab";
import { LotRow } from "./lot-row";
import { AddLotForm } from "./add-lot-form";

const merge = (used: string[], curated: readonly string[]) => [
  ...used,
  ...curated.filter((c) => !used.some((u) => u.toLowerCase() === c.toLowerCase())),
];

export default async function RakPage() {
  // Real auth boundary for this page — see lib/session.ts for why the
  // (app) layout's redirect isn't enough on its own.
  await requireSession();

  const [lots, used] = await Promise.all([
    stockSummary(db),
    distinctLotValues(db),
  ]);

  const suggestions = {
    origins: merge(used.origins, COFFEE_REGIONS.map((r) => r.name)),
    varietals: merge(used.varietals, VARIETALS),
    processMethods: merge(used.processMethods, PROCESS_METHODS),
  };
  const todayISO = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  // Daftar lot lebih dulu, urut stok menurun lalu nama: ini yang dipakai
  // hampir tiap hari. Tambah lot turun jadi <details> tertutup di bawahnya,
  // karena lot ditambah cuma beberapa minggu sekali.
  const sortedLots = [...lots].sort((a, b) => {
    if (b.stock !== a.stock) return b.stock - a.stock;
    return a.lot.name.localeCompare(b.lot.name);
  });

  return (
    <div className="flex flex-col gap-10">
      {sortedLots.length === 0 ? (
        <div className="rounded-lg border border-line bg-panel p-10 text-center">
          <p className="font-display text-lg font-medium text-ink">
            Belum ada lot.
          </p>
          <p className="mt-2 font-body text-sm text-ink-dim">
            Tambahkan lot pertama di bawah.
          </p>
        </div>
      ) : (
        <section className="flex flex-col gap-4">
          {sortedLots.map(({ lot, stock }) => (
            <LotRow
              key={lot.id}
              lotId={lot.id}
              name={lot.name}
              origin={lot.origin}
              varietal={lot.varietal}
              processMethod={lot.processMethod}
              roastDate={lot.roastDate}
              stock={stock}
            />
          ))}
        </section>
      )}

      <details open={sortedLots.length === 0}>
        <summary className="cursor-pointer font-body text-sm font-medium text-ink-dim hover:text-ink">
          Tambah lot baru
        </summary>
        <section className="mt-4 rounded-lg border border-line bg-panel p-6">
          <AddLotForm todayISO={todayISO} suggestions={suggestions} />
        </section>
      </details>
    </div>
  );
}
