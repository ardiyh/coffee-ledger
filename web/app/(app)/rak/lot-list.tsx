"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  "min-h-11 rounded-md border border-line bg-panel-2 px-2 py-1.5 font-body text-base sm:text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
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
  // Set only by the hash effect below, to whichever lot id the URL hash
  // most recently pointed at (stays at that id afterwards -- see
  // `focusedHashLotIdRef` below for how repeats are deduped, not by
  // resetting this back to null). Deliberately separate from `openLotId`
  // -- that one also changes from ordinary row clicks, and this state
  // exists purely to gate the scroll+focus effect so it only fires for a
  // hash-driven open, not every time any row opens.
  const [hashLotId, setHashLotId] = useState<number | null>(null);

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

  // Guards the effect below so the hash is only ever *applied* once per
  // mount -- on the very first run, or on a genuine `hashchange` event --
  // never merely because `lots` was swapped for a new array reference.
  // `lots` changes on every unrelated `revalidatePath` refresh anywhere on
  // this page (see the `stockRevision` comment above), and without this
  // guard the effect below would replay the *original* hash on every one
  // of those refreshes -- silently reopening lot A's panel over whatever
  // lot B the user has since opened by hand. A ref (not state) because
  // flipping it must not itself cause a re-render; it's only ever read or
  // written from inside this effect, never during render, so it doesn't
  // trip the project's react-hooks/refs rule.
  const appliedInitialHashRef = useRef(false);

  // Reads `#lot-<id>` from the URL on mount, and again on every `hashchange`
  // -- so a dashboard bar's `/rak#lot-<id>` link opens that lot's panel
  // whether it's the initial navigation or the user is already on /rak and
  // clicks a second such link (or uses browser back/forward, which also
  // fires `hashchange`). Hash changes don't trigger a Next.js navigation or
  // data refetch, so `hashchange` -- not a prop/searchParams change -- is
  // the right signal to listen for here.
  //
  // An id that doesn't parse or doesn't match any current lot is left
  // alone: no state changes, so the list stays exactly as it was.
  //
  // Same fallback reasoning as `clearSearch` above: forcing the lot open
  // already makes its row visible regardless of `status` (see `visible`
  // below), but broadening `status` too keeps the Status select honest
  // about what's actually on screen, instead of silently disagreeing with
  // an open, filtered-out row.
  //
  // This effect still depends on `[lots]` -- so a genuine `hashchange`
  // that fires after `lots` has moved on always validates the id against
  // the *current* lot list, not a stale one from mount -- but
  // `appliedInitialHashRef` stops a `lots`-only re-run from calling
  // `applyHash()` on its own; only the mount and the `hashchange` listener
  // itself do that. `history.replaceState` then drops the hash from the
  // URL once it's been consumed, so even a duplicate/late event can't
  // reapply the same id twice.
  useEffect(() => {
    function applyHash() {
      const match = /^#lot-(\d+)$/.exec(window.location.hash);
      if (!match) return;
      const id = Number(match[1]);
      const lot = lots.find((l) => l.lotId === id);
      if (!lot) return;
      setOpenLotId(id);
      setHashLotId(id);
      setStatus((current) => (matchesStatus(current, lot.stock) ? current : "all"));
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    if (!appliedInitialHashRef.current) {
      appliedInitialHashRef.current = true;
      applyHash();
    }
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [lots]);

  // Remembers which `hashLotId` value has already had its scroll+focus, so
  // a later run of the effect below for an *unrelated* dependency change --
  // `status`, e.g. the user working the Status dropdown right after landing
  // here -- doesn't redo it and yank focus back off whatever control the
  // user is actually using. A ref rather than resetting `hashLotId` itself
  // back to null: doing the reset would mean calling setState
  // unconditionally inside this effect purely to prevent it from firing
  // again, which is exactly the cascading-render anti-pattern
  // react-hooks/set-state-in-effect flags -- comparing against a ref here
  // achieves the same "only once per hash target" result without it.
  const focusedHashLotIdRef = useRef<number | null>(null);

  // Scrolls to and focuses the hash target once it's actually on screen.
  // Split from the effect above so it re-runs after the state changes
  // there have been committed -- by the time this runs, React has already
  // rendered the target's row un-hidden (see `visible` below), so a plain
  // `getElementById` here finds it with no artificial delay needed.
  // `scrollIntoView` is guarded because it isn't implemented in the jsdom
  // environment these tests run under.
  useEffect(() => {
    if (hashLotId === null || focusedHashLotIdRef.current === hashLotId) return;
    const target = document.getElementById(`lot-${hashLotId}`);
    if (!target) return;
    focusedHashLotIdRef.current = hashLotId;
    target.scrollIntoView?.({ block: "start" });
    target.focus();
  }, [hashLotId, status]);

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
            className="mt-3 inline-flex h-11 items-center justify-center rounded-full border border-line px-4 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber"
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
            // Scroll/focus target for /rak#lot-<id> links (see the hash
            // effects above) -- a thin wrapper instead of adding the id/
            // tabIndex to LotRow's own root div, so this stays inside
            // lot-list.tsx without touching lot-row.tsx. `hidden` mirrors
            // LotRow's own (both end up `display:none` via the same UA
            // rule, so this doesn't change what's visible) so the wrapper
            // doesn't leave an empty gap in the list when its row is
            // filtered out; `tabIndex={-1}` makes it focusable
            // programmatically (via the effect above) without adding it to
            // the tab order.
            <div key={lot.lotId} id={`lot-${lot.lotId}`} tabIndex={-1} hidden={!visible}>
              <LotRow
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
            </div>
          );
        })}
      </section>
    </div>
  );
}
