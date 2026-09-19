"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { daysSince, formatGrams } from "@/lib/format";
import { LotRow } from "./lot-row";
import type { TransactionReceipt } from "../actions";
import { ACTION_LABELS, type LotSuggestions, type RecordActionValue } from "./types";

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
 * A receipt only carries `kind` ("IN"/"OUT") and `reason` (the ledger's
 * broader ACQUIRE/BREW/GIFT/ADJUST) -- neither alone picks a single label
 * out of ACTION_LABELS the way the "Aksi" select's value does, since ADJUST
 * covers both ADJUST_IN and ADJUST_OUT. This recombines the two back into
 * that select's value space instead of inventing a second label map.
 */
function receiptActionValue(receipt: TransactionReceipt): RecordActionValue {
  if (receipt.reason === "ADJUST") {
    return receipt.kind === "IN" ? "ADJUST_IN" : "ADJUST_OUT";
  }
  return receipt.reason;
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
  // Tracks whichever write is in flight for the open lot -- transaction
  // record OR edit save, LotRow reports both through the same callback (see
  // LotRow's onPendingChange) -- used to stop other rows' open/Edit
  // controls from being used while that write is in flight.
  const [pendingLotId, setPendingLotId] = useState<number | null>(null);
  // The single, list-level "tercatat" banner: the last successful receipt
  // plus the name of the lot it belongs to (captured at record time, since
  // LotListItem doesn't carry a receipt itself). Deliberately never cleared
  // on a timer or on panel close -- only ever replaced by the next receipt
  // -- so a confirmation can't disappear before it's read just because the
  // row it came from closed or a filter hid it.
  const [lastReceipt, setLastReceipt] = useState<{ receipt: TransactionReceipt; lotName: string } | null>(null);

  function handleRecorded(receipt: TransactionReceipt, lotName: string) {
    setLastReceipt({ receipt, lotName });
  }

  // A fresh, unique token whenever `lots` is actually swapped for a new
  // array from the server (a revalidatePath-driven refetch) -- not on every
  // LotList re-render, since local UI state above (search/sort/which panel
  // is open) re-renders this component constantly without any new data
  // arriving. Each LotRow gets this as `stockRevision` so it can tell "the
  // server refresh landed" apart from "the stock number happens to look the
  // same as before": comparing raw stock *values* can't do that when two
  // transactions in a row net to zero (see LotRow's own comment).
  //
  // useMemo, not a ref/state pair updated from an effect: this project's
  // lint rules disallow both reading/writing a ref during render
  // (react-hooks/refs) and calling setState synchronously inside an effect
  // (react-hooks/set-state-in-effect). useMemo's dependency array already
  // gives the "did `lots` actually change" comparison for free, and a plain
  // symbol is enough -- nothing needs to compare it as a number, only ever
  // as "is this the same token as before".
  const stockRevision = useMemo(() => Symbol(`stock-revision:${lots.length}`), [lots]);

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
    // "Hapus pencarian" should do just that in the common case (a search
    // typo produced zero matches) -- silently also resetting the status
    // filter would be a surprising side effect. It only broadens status to
    // "Semua" as a fallback, when clearing the query alone still wouldn't
    // show anything (e.g. the status filter itself is the reason, such as
    // "Habis" with no empty lots).
    const queryAloneWouldMatch = lots.some((lot) => matchesStatus(status, lot.stock));
    setQuery("");
    if (!queryAloneWouldMatch) setStatus("all");
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
      {/*
        One stable status region for the whole list, not per-row: a row's
        own success text used to live inside its transaction panel, which
        gets hidden the moment the panel closes or a filter hides the row --
        easy to miss, and gone entirely once the row that showed it is no
        longer visible. This lives above the list instead, survives the
        panel closing and the row's stock going to zero, and is only ever
        replaced by the next receipt -- never auto-dismissed.
      */}
      {lastReceipt ? (
        <p
          role="status"
          className="rounded-lg border border-line bg-panel px-4 py-3 font-body text-sm text-teal"
        >
          {ACTION_LABELS[receiptActionValue(lastReceipt.receipt)]}{" "}
          {formatGrams(lastReceipt.receipt.grams)} · {lastReceipt.lotName} tercatat.{" "}
          <Link href={`/history?lot=${lastReceipt.receipt.lotId}`} className="underline hover:text-amber">
            Lihat riwayat
          </Link>
        </p>
      ) : null}

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
              stockRevision={stockRevision}
              onOpenChange={(open) => handleOpenChange(lot.lotId, open)}
              onPendingChange={(pending) => handlePendingChange(lot.lotId, pending)}
              onRecorded={(receipt) => handleRecorded(receipt, lot.name)}
            />
          );
        })}
      </section>
    </div>
  );
}
