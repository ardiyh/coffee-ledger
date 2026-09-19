"use client";

import { useMemo, useState } from "react";
import { daysSince } from "@/lib/format";
import { LotRow } from "./lot-row";
import type { LotSuggestions } from "./types";

/** Plain, serializable view of a lot -- no `db`/server types cross into this client component. */
export interface LotListItem {
  lotId: number;
  name: string;
  origin: string;
  varietal: string;
  processMethod: string | null;
  roastProfile: string | null;
  roastDate: string;
  notes: string | null;
  stock: number;
}

type Status = "active" | "empty" | "all";
type Sort = "name" | "stock" | "age";

const inputClass =
  "rounded-md border border-line bg-panel-2 px-2 py-1.5 font-body text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

function matchesStatus(status: Status, stock: number): boolean {
  if (status === "all") return true;
  return status === "active" ? stock > 0 : stock <= 0;
}

/**
 * Rak list: search + status filter + sort, and which single lot's panel
 * (transaction or edit) is open, if any.
 *
 * Every LotRow is always rendered, in `lots` order sorted here -- never
 * conditionally mounted -- so a row that fails the current search/status
 * filter is hidden via the `hidden` attribute instead of being removed
 * from the tree. That's what keeps a row's in-progress draft alive across
 * a filter change or a switch to another lot's panel.
 */
export function LotList({
  lots,
  suggestions,
}: {
  lots: LotListItem[];
  suggestions: LotSuggestions;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("active");
  const [sort, setSort] = useState<Sort>("name");
  const [openLotId, setOpenLotId] = useState<number | null>(null);
  // Only tracks the *transaction* request's pending state (see the comment
  // on LotRow's onPendingChange prop) -- used to stop other rows' open/Edit
  // controls from being used while one lot's write is in flight.
  const [pendingLotId, setPendingLotId] = useState<number | null>(null);

  const sorted = useMemo(() => {
    const copy = [...lots];
    copy.sort((a, b) => {
      const cmp =
        sort === "stock" ? b.stock - a.stock :
        sort === "age" ? daysSince(b.roastDate) - daysSince(a.roastDate) :
        a.name.localeCompare(b.name, "id-ID");
      return cmp !== 0 ? cmp : a.lotId - b.lotId;
    });
    return copy;
  }, [lots, sort]);

  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const matchedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const lot of sorted) {
      const matchesQuery =
        normalizedQuery === "" ||
        lot.name.toLocaleLowerCase("id-ID").includes(normalizedQuery) ||
        lot.origin.toLocaleLowerCase("id-ID").includes(normalizedQuery);
      if (matchesQuery && matchesStatus(status, lot.stock)) ids.add(lot.lotId);
    }
    return ids;
  }, [sorted, normalizedQuery, status]);

  function handleOpenChange(lotId: number, open: boolean) {
    // Safety net -- LotRow already disables the controls that would call
    // this while a different lot's request is pending.
    if (pendingLotId !== null && pendingLotId !== lotId) return;
    setOpenLotId(open ? lotId : null);
  }

  function handlePendingChange(lotId: number, pending: boolean) {
    setPendingLotId((current) => {
      if (pending) return lotId;
      return current === lotId ? null : current;
    });
  }

  function clearSearch() {
    setQuery("");
    // Both the search text and the status filter can independently produce
    // a zero-result view; resetting only the query would leave a status
    // filter (e.g. "Habis") silently still hiding everything. "Semua"
    // guarantees a non-empty result as long as the shelf itself isn't
    // empty.
    setStatus("all");
  }

  if (lots.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-panel p-10 text-center">
        <p className="font-display text-lg font-medium text-ink">Belum ada lot.</p>
        <p className="mt-2 font-body text-sm text-ink-dim">
          Tambahkan lot di bawah untuk mulai mengisi rak.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <span className={labelClass}>Cari</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nama atau origin..."
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as Status)}
            className={inputClass}
          >
            <option value="active">Aktif</option>
            <option value="empty">Habis</option>
            <option value="all">Semua</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Urutkan</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className={inputClass}
          >
            <option value="name">Nama</option>
            <option value="stock">Stok</option>
            <option value="age">Hari sejak roast</option>
          </select>
        </label>
      </div>

      <p className="font-body text-xs text-ink-faint">
        {matchedIds.size} dari {lots.length} lot
      </p>

      {matchedIds.size === 0 ? (
        <div className="rounded-lg border border-line bg-panel p-6 text-center">
          <p className="font-body text-sm text-ink-dim">Tidak ada lot yang cocok</p>
          <button
            type="button"
            onClick={clearSearch}
            className="mt-3 rounded-full border border-line px-4 py-1.5 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber"
          >
            Hapus pencarian
          </button>
        </div>
      ) : null}

      <section className="flex flex-col gap-4">
        {sorted.map((lot) => {
          const isOpen = lot.lotId === openLotId;
          // The open lot always stays visible, independent of search/status
          // -- otherwise switching filters (or a transaction that empties
          // the lot) would yank the panel the user is mid-interaction with
          // out from under them. See LotRow's `justEmpty` note for the
          // explanatory copy that covers the "just went empty" case.
          const visible = matchedIds.has(lot.lotId) || isOpen;
          return (
            <LotRow
              key={lot.lotId}
              lotId={lot.lotId}
              name={lot.name}
              origin={lot.origin}
              varietal={lot.varietal}
              processMethod={lot.processMethod}
              roastProfile={lot.roastProfile}
              roastDate={lot.roastDate}
              notes={lot.notes}
              stock={lot.stock}
              suggestions={suggestions}
              hidden={!visible}
              isOpen={isOpen}
              otherPending={pendingLotId !== null && pendingLotId !== lot.lotId}
              onOpenChange={(open) => handleOpenChange(lot.lotId, open)}
              onPendingChange={(pending) => handlePendingChange(lot.lotId, pending)}
            />
          );
        })}
      </section>
    </div>
  );
}
