"use client";

import { useActionState, useEffect, useState } from "react";
import { recordAction, type ActionState } from "../actions";
import { daysSince, formatGrams } from "@/lib/format";
import { EditLotForm } from "./edit-lot-form";
import type { LotSuggestions } from "./types";

const initialActionState: ActionState = {};

const inputClass =
  "rounded-md border border-line bg-panel-2 px-2 py-1.5 font-body text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

const ACTION_OPTIONS = [
  { value: "ACQUIRE", label: "Masuk / beli" },
  { value: "BREW", label: "Seduh" },
  { value: "GIFT", label: "Kasih orang" },
  { value: "ADJUST_IN", label: "Koreksi naik" },
  { value: "ADJUST_OUT", label: "Koreksi turun" },
] as const;

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
}

export function LotRow({
  lotId, name, origin, varietal, processMethod, roastProfile, roastDate, notes, stock, suggestions,
  hidden, isOpen, otherPending, onOpenChange, onPendingChange,
}: LotRowProps) {
  // "editing" only matters while this row is open -- it picks which of the
  // two panels (transaction vs. edit) the single open slot shows. It stays
  // local to LotRow (not lifted to LotList) for the same reason kind/grams/
  // note do: it must survive this row being hidden and shown again.
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  const [grams, setGrams] = useState("");
  const [note, setNote] = useState("");

  async function submit(prevState: ActionState, formData: FormData) {
    const result = await recordAction(prevState, formData);
    if (result.success) {
      setKind(null);
      setGrams("");
      setNote("");
    }
    return result;
  }
  const [state, formAction, pending] = useActionState(submit, initialActionState);

  // Bubble this row's own transaction-pending state up so LotList can block
  // switching to a different lot mid-submit. We can't do the same for
  // EditLotForm's pending -- it doesn't expose one across its props
  // boundary, and that file is out of scope here -- but EditLotForm already
  // disables its own Batal button while saving, which is the same
  // protective intent at a smaller scope.
  useEffect(() => {
    onPendingChange(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // No effect needed to reset `editing` when this row closes: every path
  // that sets isOpen to true (toggleOpen, openForEdit below) also sets
  // `editing` explicitly in the same handler, and every place that reads
  // `editing` gates it behind `isOpen` first (render below, aria-expanded,
  // the panel's `hidden`), so a stale `editing` value while closed is
  // simply never observed.

  // Closing this row (or switching it away from "open") is only blocked
  // while its own transaction request is in flight -- see the comment on
  // onPendingChange above for why edit-pending isn't covered the same way.
  const closeBlocked = isOpen && pending;
  const controlsDisabled = otherPending || closeBlocked;

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

  return (
    <div hidden={hidden} className="rounded-lg border border-line bg-panel p-4">
      {editing && isOpen ? (
        <EditLotForm
          lotId={lotId}
          initial={{ name, origin, varietal, processMethod, roastProfile, roastDate, notes }}
          suggestions={suggestions}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-4">
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
            <span className="font-mono text-lg tabular-nums text-ink">
              {formatGrams(stock)}
            </span>
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
      )}

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
              <select name="kind" required value={kind ?? (stock > 0 ? "BREW" : "ACQUIRE")}
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
              <span className={labelClass}>Catatan (opsional)</span>
              <input name="note" type="text" value={note} onChange={(event) => setNote(event.target.value)}
                className={inputClass} placeholder="Catatan tambahan..." />
            </label>
            <button type="submit" disabled={pending}
              className="rounded-full bg-amber px-5 py-2 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-hover disabled:opacity-50">
              {pending ? "Menyimpan..." : "Catat"}
            </button>
            {state.error ? (
              <p className="w-full font-body text-sm text-clay-ink" role="alert">{state.error}</p>
            ) : null}
            {state.success ? (
              <p className="w-full font-body text-sm text-teal" role="status">Tercatat.</p>
            ) : null}
          </fieldset>
        </form>
      </div>
    </div>
  );
}
