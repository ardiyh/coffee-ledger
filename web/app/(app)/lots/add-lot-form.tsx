"use client";

import { useActionState, useRef, useEffect } from "react";
import { addLotAction, type ActionState } from "../actions";
import { COFFEE_REGIONS } from "@/lib/regions";

const initialActionState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-line bg-panel-2 px-3 py-2 font-body text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

export function AddLotForm({ todayISO }: { todayISO: string }) {
  const [state, formAction, pending] = useActionState(
    addLotAction,
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
      <label className="flex flex-col gap-1">
        <span className={labelClass}>Nama</span>
        <input
          name="name"
          type="text"
          required
          className={inputClass}
          placeholder="Gayo Wine Natural"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Origin</span>
        <input
          name="origin"
          type="text"
          required
          list="coffee-regions"
          className={inputClass}
          placeholder="Kerinci, Jambi"
        />
        <datalist id="coffee-regions">
          {COFFEE_REGIONS.map((r) => (
            <option key={r.name} value={r.name} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Varietal</span>
        <input
          name="varietal"
          type="text"
          required
          className={inputClass}
          placeholder="Gayo 1"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Tanggal roast</span>
        <input
          name="roastDate"
          type="date"
          required
          defaultValue={todayISO}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Stok awal, gram (opsional)</span>
        <input
          name="initialGrams"
          type="number"
          step="any"
          min="0"
          className={inputClass}
          placeholder="250"
        />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={labelClass}>Catatan (opsional)</span>
        <textarea
          name="notes"
          rows={2}
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
          {pending ? "Menyimpan..." : "Tambah lot"}
        </button>
        {state.error ? (
          <p className="font-body text-sm text-clay" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="font-body text-sm text-teal">Lot ditambahkan.</p>
        ) : null}
      </div>
    </form>
  );
}
