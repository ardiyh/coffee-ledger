"use client";

import { useActionState, useEffect, useState } from "react";
import { editLotAction, type ActionState } from "../actions";
import { ROAST_PROFILES } from "@/lib/coffee-vocab";
import type { LotSuggestions } from "./types";

const initialActionState: ActionState = {};

const inputClass =
  "min-h-11 w-full rounded-md border border-line bg-panel-2 px-3 py-2 font-body text-base sm:text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

export interface EditLotFormProps {
  lotId: number;
  initial: {
    name: string;
    origin: string;
    varietal: string;
    processMethod: string | null;
    roastProfile: string | null;
    roastDate: string;
    notes: string | null;
  };
  suggestions: LotSuggestions;
  onCancel: () => void;
  onSaved: () => void;
  /**
   * Optional: lets a parent that keeps this form mounted-but-hidden (so an
   * unsaved draft survives being hidden) also know when a save is in
   * flight, e.g. to avoid letting the user navigate away from it. Purely
   * additive -- omitting it changes nothing.
   */
  onPendingChange?: (pending: boolean) => void;
}

/**
 * Form edit data deskriptif lot, dipasang inline di dalam LotRow saat mode
 * edit aktif. Tidak punya logic penyusunan nama otomatis seperti AddLotForm:
 * "kata khusus" yang dipakai composeLotName tidak disimpan sebagai kolom,
 * jadi begitu lot tersimpan, name cuma teks bebas biasa.
 */
export function EditLotForm({
  lotId,
  initial,
  suggestions,
  onCancel,
  onSaved,
  onPendingChange,
}: EditLotFormProps) {
  const [fields, setFields] = useState(initial);
  // Sama seperti AddLotForm: keluar dari mode edit terjadi di sini, setelah
  // tahu tulisannya sukses -- bukan lewat useEffect yang mengamati state.success.
  async function submit(prevState: ActionState, formData: FormData) {
    const result = await editLotAction(prevState, formData);
    if (result.success) onSaved();
    return result;
  }

  const [state, formAction, pending] = useActionState(submit, initialActionState);

  useEffect(() => {
    onPendingChange?.(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <form action={formAction}>
      <fieldset disabled={pending} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="hidden" name="lotId" value={lotId} />

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Nama</span>
          <input
            name="name"
            type="text"
            required
            value={fields.name}
            onChange={(event) => setFields({ ...fields, name: event.target.value })}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Origin</span>
          <input
            name="origin"
            type="text"
            required
            list={`edit-origins-${lotId}`}
            value={fields.origin}
            onChange={(event) => setFields({ ...fields, origin: event.target.value })}
            className={inputClass}
          />
          <datalist id={`edit-origins-${lotId}`}>
            {suggestions.origins.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Varietal</span>
          <input
            name="varietal"
            type="text"
            required
            list={`edit-varietals-${lotId}`}
            value={fields.varietal}
            onChange={(event) => setFields({ ...fields, varietal: event.target.value })}
            className={inputClass}
          />
          <datalist id={`edit-varietals-${lotId}`}>
            {suggestions.varietals.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Proses pasca panen</span>
          <input
            name="processMethod"
            type="text"
            required
            list={`edit-process-${lotId}`}
            value={fields.processMethod ?? ""}
            onChange={(event) => setFields({ ...fields, processMethod: event.target.value })}
            className={inputClass}
          />
          <datalist id={`edit-process-${lotId}`}>
            {suggestions.processMethods.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Profil roast</span>
          <select
            name="roastProfile"
            required
            value={fields.roastProfile ?? ""}
            onChange={(event) => setFields({ ...fields, roastProfile: event.target.value })}
            className={inputClass}
          >
            <option value="" disabled>Pilih profil roast</option>
            {ROAST_PROFILES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Tanggal roast</span>
          <input
            name="roastDate"
            type="date"
            required
            value={fields.roastDate}
            onChange={(event) => setFields({ ...fields, roastDate: event.target.value })}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClass}>Catatan (opsional)</span>
          <textarea
            name="notes"
            rows={2}
            value={fields.notes ?? ""}
            onChange={(event) => setFields({ ...fields, notes: event.target.value })}
            className={inputClass}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-full bg-amber px-5 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-hover disabled:opacity-50"
          >
            {pending ? "Menyimpan..." : "Simpan"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 font-body text-sm text-ink-dim transition-colors hover:border-clay hover:text-clay-ink disabled:opacity-50"
          >
            Batal
          </button>
          {state.error ? (
            <p className="w-full font-body text-sm text-clay-ink" role="alert">
              {state.error}
            </p>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}
