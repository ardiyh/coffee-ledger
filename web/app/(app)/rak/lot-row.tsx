"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { recordAction, type ActionState, type TransactionReceipt } from "../actions";
import { daysSince, formatGrams } from "@/lib/format";
import { EditLotForm } from "./edit-lot-form";
import { ACTION_OPTIONS, type LotSuggestions } from "./types";

const initialActionState: ActionState = {};

/** Which panel is displayed while a row is open -- see `panelView` state below. */
type PanelView = "transaction" | "edit";

const inputClass =
  "min-h-11 rounded-md border border-line bg-panel-2 px-2 py-1.5 font-body text-base sm:text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

export interface LotRowProps {
  lotId: number;
  name: string;
  origin: string;
  varietal: string;
  processMethod: string | null;
  roastProfile: string | null;
  roastDate: string;
  notes: string | null;
  stock: number;
  /**
   * Bumped by LotList whenever `lots` is actually swapped for a fresh array
   * from the server -- see LotList's own comment. Used (not `stock`
   * itself) to detect that a post-submit refresh has landed, because two
   * transactions in a row can net to a `stock` value identical to before
   * either one, which a raw value comparison would never notice.
   */
  stockRevision: symbol;
  suggestions: LotSuggestions;
  /**
   * Hides the whole row via the `hidden` attribute rather than unmounting
   * it -- LotList always renders every LotRow so draft state (this row's
   * own kind/grams/note, and EditLotForm's internal fields) survives being
   * hidden and shown again.
   */
  hidden: boolean;
  /** Whether *this* lot is the one LotList currently has open. */
  isOpen: boolean;
  /**
   * True when a different lot's transaction request is in flight. Blocks
   * this row's own open/Edit controls so the user can't navigate away from
   * the lot with the pending request and lose sight of its outcome.
   */
  otherPending: boolean;
  onOpenChange: (open: boolean) => void;
  onPendingChange: (pending: boolean) => void;
  /**
   * Fired with the transaction receipt after a successful record (not
   * after an edit save -- edits don't produce a receipt). LotList uses
   * this to drive its single list-level "tercatat" banner; LotRow itself
   * no longer shows its own success text, so this is the only place a
   * successful record becomes visible once submitted.
   */
  onRecorded: (receipt: TransactionReceipt) => void;
}

export function LotRow({
  lotId, name, origin, varietal, processMethod, roastProfile, roastDate, notes, stock, stockRevision, suggestions,
  hidden, isOpen, otherPending, onOpenChange, onPendingChange, onRecorded,
}: LotRowProps) {
  // Whether EditLotForm should stay mounted at all, independent of which
  // panel is currently shown (see `panelView` right below for that).
  // Stays local to LotRow (not lifted to LotList) for the same reason
  // kind/grams/note do: it must survive this row being hidden and shown
  // again.
  const [editing, setEditing] = useState(false);
  // Which panel to show *while this row is open* -- deliberately a separate
  // piece of state from `editing` above, and deliberately a named union
  // rather than a second boolean, so "mounted" and "displayed" can never be
  // confused for each other again the way they were in UX-01: returning to
  // a lot via its "Catat" button, rather than its "Edit" button, went
  // through toggleOpen's open branch, which used to call setEditing(false)
  // unconditionally -- unmounting EditLotForm even though this row wasn't
  // visible at that moment. toggleOpen sets this to "transaction";
  // openForEdit sets it to "edit"; handleEditExit resets it to
  // "transaction" so that cancelling/saving while still open reveals the
  // transaction panel/header again instead of leaving both hidden.
  const [panelView, setPanelView] = useState<PanelView>("transaction");
  const [kind, setKind] = useState<string | null>(null);
  const [grams, setGrams] = useState("");
  const [note, setNote] = useState("");
  // Bubbled up from EditLotForm's own useActionState via onPendingChange
  // below -- lets this row (and LotList) know an edit save is in flight
  // even while EditLotForm is mounted-but-hidden (see the render below).
  const [editPending, setEditPending] = useState(false);
  // True from the moment a record succeeds until a render with genuinely
  // fresh data has been observed -- see the effect below for what counts
  // as "fresh" and why, and LotList's `stockRevision` comment for where
  // that signal comes from.
  const [awaitingStockRefresh, setAwaitingStockRefresh] = useState(false);
  // The `stockRevision` that was current at the moment of the last
  // successful submit. Once the live prop diverges from this, a fresh
  // render has landed and the "Memperbarui stok…" placeholder can clear.
  //
  // This deliberately keys off `stockRevision`, not `stock` itself: `stock`
  // is just a number, and two transactions submitted back to back can have
  // a combined effect of zero (e.g. an 18g BREW followed by an 18g
  // ADJUST_IN) -- the refreshed `stock` would then be numerically identical
  // to what was already showing, so comparing values would never detect
  // that the refresh actually happened and this would stay stuck showing
  // "Memperbarui stok…" forever. `stockRevision` changes independently of
  // whether the number itself moved, so it doesn't have that blind spot.
  const revisionAtLastSuccessRef = useRef(stockRevision);

  async function submit(prevState: ActionState, formData: FormData) {
    const result = await recordAction(prevState, formData);
    if (result.success) {
      setKind(null);
      setGrams("");
      setNote("");
      revisionAtLastSuccessRef.current = stockRevision;
      setAwaitingStockRefresh(true);
      if (result.receipt) onRecorded(result.receipt);
    }
    return result;
  }
  const [state, formAction, pending] = useActionState(submit, initialActionState);

  // `pending` flips back to false as soon as the action itself resolves,
  // which can land a render before Next.js's revalidatePath-driven refetch
  // actually delivers fresh props -- there's no built-in signal for "the
  // parent hasn't re-rendered with new data yet", so this watches
  // `stockRevision` instead: once it differs from the value captured right
  // before the successful submit, the refresh has visibly landed,
  // regardless of what the resulting `stock` number turns out to be.
  useEffect(() => {
    if (awaitingStockRefresh && stockRevision !== revisionAtLastSuccessRef.current) {
      setAwaitingStockRefresh(false);
    }
  }, [stockRevision, awaitingStockRefresh]);

  // Bubble this row's own pending state up so LotList can block switching
  // to a different lot mid-submit -- combines the transaction form's own
  // useActionState pending with EditLotForm's (reported via its optional
  // onPendingChange prop), since only one of the two can ever be the
  // active panel at a time.
  useEffect(() => {
    onPendingChange(pending || editPending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, editPending]);

  // `editing` is deliberately never reset just because this row closes or
  // a different panel is shown -- EditLotForm stays mounted for as long as
  // `editing` is true regardless of `isOpen` or `panelView` (see the
  // render below), so a stale `editing` left over from before this row was
  // closed/switched away is exactly the point: it's what keeps the draft
  // (and an in-flight save) alive while the user looks at another lot, or
  // at this same lot's transaction panel instead (UX-01). Only
  // `handleEditExit` (a real Batal/Simpan) ever sets it back to false.
  // `panelView` is the one that gates *visibility* of which panel shows
  // while `isOpen` -- toggleOpen and openForEdit below set it independently
  // of `editing`, precisely so switching panels can never destroy a draft.

  // `editPending` is reset here (not just from EditLotForm's own
  // onPendingChange effect) because the moment `editing` flips to false,
  // EditLotForm unmounts in the same commit -- its own pending-changed-to-
  // false effect can race with that unmount and never fire. Resetting it
  // eagerly, right alongside `setEditing(false)`, keeps it from getting
  // stuck at `true` forever (which would permanently disable this row's
  // and every other row's controls).
  function handleEditExit() {
    setEditing(false);
    setEditPending(false);
    setPanelView("transaction");
  }

  // This row's own controls (Edit / "Catat untuk ...") are blocked
  // whenever IT has a request in flight -- transaction or edit, open or
  // closed -- not just while open, so the user can't sidestep the
  // in-flight edit save by reopening this same row in record mode. Other
  // rows are blocked via `otherPending`, fed by the bubbled-up pending
  // state above.
  const ownPending = pending || editPending;
  const controlsDisabled = otherPending || ownPending;

  function toggleOpen() {
    if (controlsDisabled) return;
    if (isOpen) {
      onOpenChange(false);
    } else {
      // Show the transaction panel, not the edit one -- but do NOT touch
      // `editing`. If an edit draft was left mounted-but-hidden from
      // before this row was closed, forcing `editing` false here would
      // destroy it just to bring up the transaction panel (UX-01). Only
      // `panelView` (which panel is currently on screen) needs to
      // change; `editing` (whether EditLotForm stays mounted) doesn't.
      setPanelView("transaction");
      onOpenChange(true);
    }
  }

  function openForEdit() {
    if (controlsDisabled) return;
    setEditing(true);
    setPanelView("edit");
    onOpenChange(true);
  }

  // LotList keeps the currently open lot visible regardless of the status
  // filter (see lot-list.tsx), specifically so a transaction that empties
  // a lot mid-interaction doesn't yank it out from under the user. Explain
  // why it's still here instead of leaving it unexplained.
  const justEmpty = isOpen && panelView !== "edit" && stock <= 0;

  // Drives both the select's default value and the note field's GIFT-only
  // label/helper below -- computed once so the two stay in sync with
  // whatever the user actually has selected (or the same stock-based
  // default the select itself falls back to before any choice is made).
  const effectiveKind = kind ?? (stock > 0 ? "BREW" : "ACQUIRE");
  const isGift = effectiveKind === "GIFT";

  return (
    <div hidden={hidden} className="rounded-lg border border-line bg-panel p-4">
      {/*
        EditLotForm is mounted for as long as `editing` is true -- not
        `editing && isOpen`. If it were unmounted the moment this row
        closes (e.g. the user opens a different lot), its internal
        useState(initial) draft, and any editLotAction request still in
        flight, would be destroyed along with it. Instead it stays
        mounted, just hidden, exactly like the transaction panel below and
        the draft state (kind/grams/note) already on this component.
      */}
      {editing ? (
        // `panelView` (not just `isOpen`) gates visibility here: this row
        // can be open with the transaction panel showing while an edit
        // draft still sits mounted-but-hidden underneath (see toggleOpen's
        // comment) -- that's the whole point of keeping `editing` and
        // `panelView` separate.
        <div id={`lot-edit-${lotId}`} hidden={!isOpen || panelView !== "edit"}>
          <EditLotForm
            lotId={lotId}
            initial={{ name, origin, varietal, processMethod, roastProfile, roastDate, notes }}
            suggestions={suggestions}
            onCancel={handleEditExit}
            onSaved={handleEditExit}
            onPendingChange={setEditPending}
          />
        </div>
      ) : null}

      <div hidden={isOpen && panelView === "edit"} className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]">
          <p className="font-body text-base text-ink">{name}</p>
          <p className="mt-1 font-body text-xs text-ink-faint">
            {origin} · {varietal} · {processMethod ?? "proses tidak dicatat"}
            {" · "}
            {roastProfile ?? "profil tidak dicatat"}
            {" · "}
            {daysSince(roastDate)} hari sejak roast
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex flex-col items-end gap-0.5">
            <span className={labelClass}>Stok saat ini</span>
            {awaitingStockRefresh ? (
              <span className="font-mono text-sm text-ink-faint">Memperbarui stok…</span>
            ) : (
              <span className="font-mono text-lg tabular-nums text-ink">
                {formatGrams(stock)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={openForEdit}
            disabled={controlsDisabled}
            className="inline-flex h-11 items-center justify-center rounded-full border border-line px-4 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={toggleOpen}
            disabled={controlsDisabled}
            aria-expanded={isOpen && panelView !== "edit"}
            aria-controls={`lot-form-${lotId}`}
            aria-label={`Catat untuk ${name}`}
            className="inline-flex h-11 items-center justify-center rounded-full border border-line px-4 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber disabled:opacity-50"
          >
            Catat
          </button>
        </div>
      </div>

      <div id={`lot-form-${lotId}`} hidden={!isOpen || panelView === "edit"}>
        {justEmpty ? (
          <p className="mt-4 font-body text-xs text-clay-ink">
            Stok sudah habis. Panel ini tetap terbuka sampai kamu menutupnya.
          </p>
        ) : null}
        <form action={formAction} className="mt-4 border-t border-line pt-4">
          <fieldset disabled={pending} className="flex min-w-0 flex-wrap items-end gap-3">
            <input type="hidden" name="lotId" value={lotId} />
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Aksi</span>
              <select name="kind" required value={effectiveKind}
                onChange={(event) => setKind(event.target.value)} className={inputClass}>
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Gram</span>
              <input name="grams" type="number" inputMode="decimal" step="any" min="0" required
                value={grams} onChange={(event) => setGrams(event.target.value)}
                className={`${inputClass} w-24`} placeholder={stock > 0 ? "18" : "250"} />
            </label>
            <label className="flex flex-1 min-w-[10rem] flex-col gap-1">
              <span className={labelClass}>{isGift ? "Penerima (opsional)" : "Catatan (opsional)"}</span>
              <input name="note" type="text" value={note} onChange={(event) => setNote(event.target.value)}
                className={inputClass} placeholder={isGift ? "Nama penerima..." : "Catatan tambahan..."} />
              {isGift ? (
                <span className="font-body text-xs text-ink-faint">
                  Isi nama penerima saja; dipakai untuk ringkasan hadiah.
                </span>
              ) : null}
            </label>
            <button type="submit" disabled={pending}
              className="inline-flex h-11 items-center justify-center rounded-full bg-amber px-5 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-hover disabled:opacity-50">
              {pending ? "Menyimpan..." : "Catat"}
            </button>
            {state.error ? (
              <p className="w-full font-body text-sm text-clay-ink" role="alert">{state.error}</p>
            ) : null}
          </fieldset>
        </form>
      </div>
    </div>
  );
}
