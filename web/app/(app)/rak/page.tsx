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
  const activeLots = sortedLots.filter(({ stock }) => stock > 0);
  const emptyLots = sortedLots.filter(({ stock }) => stock <= 0);
  const renderLot = ({ lot, stock }: (typeof lots)[number]) => (
    <LotRow key={lot.id} lotId={lot.id} name={lot.name} origin={lot.origin}
      varietal={lot.varietal} processMethod={lot.processMethod} roastProfile={lot.roastProfile}
      roastDate={lot.roastDate} notes={lot.notes} stock={stock} suggestions={suggestions} />
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-medium text-ink">Rak</h1>
        {/*
          A plain fragment link: navigating to an id hidden inside a closed
          <details> makes the browser open that ancestor and scroll to the
          target on its own (the HTML "reveal" algorithm) -- no client JS
          needed. tabindex on the target section makes it focusable, so the
          jump also lands keyboard focus somewhere visible, not just scroll.
        */}
        <a
          href="#tambah-lot-form"
          className="rounded-full border border-line px-4 py-2 font-body text-sm text-ink transition-colors hover:border-amber hover:text-amber"
        >
          Tambah lot
        </a>
      </div>
      {activeLots.length === 0 ? (
        <div className="rounded-lg border border-line bg-panel p-10 text-center">
          <p className="font-display text-lg font-medium text-ink">
            {lots.length === 0 ? "Belum ada lot." : "Belum ada stok aktif."}
          </p>
          <p className="mt-2 font-body text-sm text-ink-dim">
            Tambahkan lot di bawah atau isi kembali lot yang sudah habis.
          </p>
        </div>
      ) : (
        <section className="flex flex-col gap-4">
          {activeLots.map(renderLot)}
        </section>
      )}

      <details open={activeLots.length === 0}>
        <summary className="cursor-pointer font-body text-sm font-medium text-ink-dim hover:text-ink">
          Tambah lot baru
        </summary>
        <section
          id="tambah-lot-form"
          tabIndex={-1}
          className="mt-4 rounded-lg border border-line bg-panel p-6 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-amber"
        >
          <AddLotForm todayISO={todayISO} suggestions={suggestions} />
        </section>
      </details>

      {emptyLots.length > 0 ? (
        <details>
          <summary className="cursor-pointer font-body text-sm font-medium text-ink-dim hover:text-ink">
            Lot habis ({emptyLots.length})
          </summary>
          <section className="mt-4 flex flex-col gap-4">{emptyLots.map(renderLot)}</section>
        </details>
      ) : null}
    </div>
  );
}
