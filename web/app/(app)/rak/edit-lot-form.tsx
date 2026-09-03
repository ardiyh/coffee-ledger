"use client";

import { useActionState } from "react";
import { editLotAction, type ActionState } from "../actions";

const initialActionState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-line bg-panel-2 px-3 py-2 font-body text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

interface LotSuggestions {
  origins: string[];
  varietals: string[];
  processMethods: string[];
}

export interface EditLotFormProps {
  lotId: number;
  initial: {
    name: string;
    origin: string;
    varietal: string;
    processMethod: string | null;
    roastDate: string;
    notes: string | null;
  };
  suggestions: LotSuggestions;
  onCancel: () => void;
  onSaved: () => void;
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
}: EditLotFormProps) {
  // Sama seperti AddLotForm: keluar dari mode edit terjadi di sini, setelah
  // tahu tulisannya sukses -- bukan lewat useEffect yang mengamati state.success.
  async function submit(prevState: ActionState, formData: FormData) {
    const result = await editLotAction(prevState, formData);
    if (result.success) onSaved();
    return result;
  }

  const [state, formAction, pending] = useActionState(submit, initialActionState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input type="hidden" name="lotId" value={lotId} />

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Nama</span>
        <input
          name="name"
          type="text"
          required
          defaultValue={initial.name}
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
          defaultValue={initial.origin}
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
          defaultValue={initial.varietal}
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
          defaultValue={initial.processMethod ?? ""}
          className={inputClass}
        />
        <datalist id={`edit-process-${lotId}`}>
          {suggestions.processMethods.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Tanggal roast</span>
        <input
          name="roastDate"
          type="date"
          required
          defaultValue={initial.roastDate}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClass}>Catatan (opsional)</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={initial.notes ?? ""}
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-amber px-5 py-2 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-dim disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-line px-5 py-2 font-body text-sm text-ink-dim transition-colors hover:border-clay hover:text-clay"
        >
          Batal
        </button>
        {state.error ? (
          <p className="w-full font-body text-sm text-clay" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
