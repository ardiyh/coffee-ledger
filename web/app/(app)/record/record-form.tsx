"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordAction, type ActionState } from "../actions";

const initialActionState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-line bg-panel-2 px-3 py-2 font-body text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

export interface LotOption {
  id: number;
  name: string;
  stockLabel: string;
}

const ACTION_OPTIONS = [
  { value: "ACQUIRE", label: "Masuk / beli" },
  { value: "BREW", label: "Seduh" },
  { value: "GIFT", label: "Kasih orang" },
  { value: "ADJUST_IN", label: "Koreksi naik" },
  { value: "ADJUST_OUT", label: "Koreksi turun" },
] as const;

export function RecordForm({ lots }: { lots: LotOption[] }) {
  const [state, formAction, pending] = useActionState(
    recordAction,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClass}>Lot</span>
        <select name="lotId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Pilih lot...
          </option>
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.name} — stok {lot.stockLabel}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Aksi</span>
        <select
          name="kind"
          required
          defaultValue="ACQUIRE"
          className={inputClass}
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Gram</span>
        <input
          name="grams"
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          required
          className={inputClass}
          placeholder="250"
        />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClass}>Catatan (opsional)</span>
        <input
          name="note"
          type="text"
          className={inputClass}
          placeholder="Catatan tambahan..."
        />
      </label>

      <div className="flex items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-amber px-5 py-2 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-dim disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Catat"}
        </button>
        {state.error ? (
          <p className="font-body text-sm text-clay" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="font-body text-sm text-teal">Tercatat.</p>
        ) : null}
      </div>
    </form>
  );
}
