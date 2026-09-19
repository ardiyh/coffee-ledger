import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { distinctLotValues, stockSummary } from "@/lib/ledger/service";
import { COFFEE_REGIONS } from "@/lib/regions";
import { VARIETALS, PROCESS_METHODS } from "@/lib/coffee-vocab";
import { LotList, type LotListItem } from "./lot-list";
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

  // Search/sort/status-filter and which lot's panel is open all live in
  // LotList (a client component) -- only plain, serializable fields cross
  // that boundary, never `db`/`lot`/`Lot` server types.
  const items: LotListItem[] = lots.map(({ lot, stock }) => ({
    lotId: lot.id, name: lot.name, origin: lot.origin, varietal: lot.varietal,
    processMethod: lot.processMethod, roastProfile: lot.roastProfile,
    roastDate: lot.roastDate, notes: lot.notes, stock,
  }));

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

      <LotList lots={items} suggestions={suggestions} />

      {/*
        Always reachable regardless of LotList's search/filter state --
        rendered here, outside LotList, so nothing it does can hide this.
        Open by default only when the shelf has literally no lots yet;
        LotList now owns the active/empty split, so RakPage no longer
        tries to guess whether the default "Aktif" view is empty.
      */}
      <details open={lots.length === 0}>
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
    </div>
  );
}
