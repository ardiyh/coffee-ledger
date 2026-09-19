"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { recordAction, type ActionState, type TransactionReceipt } from "../actions";
import { daysSince, formatGrams } from "@/lib/format";
import { EditLotForm } from "./edit-lot-form";
import type { LotSuggestions } from "./types";

const initialActionState: ActionState = {};

const inputClass =
  "rounded-md border border-line bg-panel-2 px-2 py-1.5 font-body text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

/**
 * Source of truth for both the "Aksi" select's options and, in LotList, the
 * human verb shown in the receipt banner -- so the two can't drift apart
 * into two different names for the same action.
 */
export const ACTION_OPTIONS = [
  { value: "ACQUIRE", label: "Masuk / beli" },
  { value: "BREW", label: "Seduh" },
  { value: "GIFT", label: "Kasih orang" },
  { value: "ADJUST_IN", label: "Koreksi naik" },
  { value: "ADJUST_OUT", label: "Koreksi turun" },
] as const;

export type RecordActionValue = (typeof ACTION_OPTIONS)[number]["value"];

export const ACTION_LABELS = Object.fromEntries(
  ACTION_OPTIONS.map((opt) => [opt.value, opt.label]),
) as Record<RecordActionValue, string>;

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
  lotId, name, origin, varietal, processMethod, roastProfile, roastDate, notes, stock, suggestions,
  hidden, isOpen, otherPending, onOpenChange, onPendingChange, onRecorded,
}: LotRowProps) {
  // "editing" only matters while this row is open -- it picks which of the
  // two panels (transaction vs. edit) the single open slot shows. It stays
  // local to LotRow (not lifted to LotList) for the same reason kind/grams/
  // note do: it must survive this row being hidden and shown again.
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  const [grams, setGrams] = useState("");
  const [note, setNote] = useState("");
  // Bubbled up from EditLotForm's own useActionState via onPendingChange
  // below -- lets this row (and LotList) know an edit save is in flight
  // even while EditLotForm is mounted-but-hidden (see the render below).
  const [editPending, setEditPending] = useState(false);
  // True from the moment a record succeeds until the `stock` prop actually
  // changes -- see the effect below for why a prop change is the signal.
  const [awaitingStockRefresh, setAwaitingStockRefresh] = useState(false);
  // The `stock` value that was current at the moment of the last successful
  // submit. Once the (revalidation-driven) `stock` prop diverges from this,
  // fresh data has landed and the "Memperbarui stok…" placeholder can clear.
  const stockAtLastSuccessRef = useRef(stock);

  async function submit(prevState: ActionState, formData: FormData) {
    const stockBeforeSubmit = stock;
    const result = await recordAction(prevState, formData);
    if (result.success) {
      setKind(null);
      setGrams("");
      setNote("");
      stockAtLastSuccessRef.current = stockBeforeSubmit;
      setAwaitingStockRefresh(true);
      if (result.receipt) onRecorded(result.receipt);
    }
    return result;
  }
  const [state, formAction, pending] = useActionState(submit, initialActionState);

  // `pending` flips back to false as soon as the action itself resolves,
  // which can land a render before Next.js's revalidatePath-driven refetch
  // actually delivers a fresh `stock` prop -- there's no built-in signal for
  // "the parent hasn't re-rendered with new data yet", so this compares the
  // live prop against the value captured right before the successful
  // submit: once they differ, the refresh has visibly landed.
  useEffect(() => {
    if (awaitingStockRefresh && stock !== stockAtLastSuccessRef.current) {
      setAwaitingStockRefresh(false);
    }
  }, [stock, awaitingStockRefresh]);

  // Bubble this row's own pending state up so LotList can block switching
  // to a different lot mid-submit -- combines the transaction form's own
  // useActionState pending with EditLotForm's (reported via its optional
  // onPendingChange prop), since only one of the two can ever be the
  // active panel at a time.
  useEffect(() => {
    onPendingChange(pending || editPending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, editPending]);

  // No effect needed to reset `editing` when this row closes: every path
  // that sets isOpen to true (toggleOpen, openForEdit below) also sets
  // `editing` explicitly in the same handler, and every place that reads
  // `editing` gates *visibility* behind `isOpen` first (render below,
  // aria-expanded, the panels' `hidden`). EditLotForm itself, though,
  // stays mounted for as long as `editing` is true regardless of `isOpen`
  // -- see the render below -- so a stale `editing` left over from before
  // this row was closed is exactly the point: it's what keeps the draft
  // (and an in-flight save) alive while the user looks at another lot.

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
      setEditing(false);
      onOpenChange(true);
    }
  }

  function openForEdit() {
    if (controlsDisabled) return;
    setEditing(true);
    onOpenChange(true);
  }

  // LotList keeps the currently open lot visible regardless of the status
  // filter (see lot-list.tsx), specifically so a transaction that empties
  // a lot mid-interaction doesn't yank it out from under the user. Explain
  // why it's still here instead of leaving it unexplained.
  const justEmpty = isOpen && !editing && stock <= 0;

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
        <div id={`lot-edit-${lotId}`} hidden={!isOpen}>
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

      <div hidden={isOpen && editing} className="flex flex-wrap items-start justify-between gap-4">
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
        <div className="flex shrink-0 items-center gap-3">
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
            className="rounded-full border border-line px-3 py-1 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={toggleOpen}
            disabled={controlsDisabled}
            aria-expanded={isOpen && !editing}
            aria-controls={`lot-form-${lotId}`}
            className="rounded-full border border-line px-3 py-1 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber disabled:opacity-50"
          >
            {`Catat untuk ${name}`}
          </button>
        </div>
      </div>

      <div id={`lot-form-${lotId}`} hidden={!isOpen || editing}>
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
              className="rounded-full bg-amber px-5 py-2 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-hover disabled:opacity-50">
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
