"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { addLotAction, type ActionState } from "../actions";
import { composeLotName } from "@/lib/format";

const initialActionState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-line bg-panel-2 px-3 py-2 font-body text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

interface LotSuggestions {
  origins: string[];
  varietals: string[];
  processMethods: string[];
}

export function AddLotForm({
  todayISO,
  suggestions,
}: {
  todayISO: string;
  suggestions: LotSuggestions;
}) {
  const [state, formAction, pending] = useActionState(
    addLotAction,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const [origin, setOrigin] = useState("");
  const [processMethod, setProcessMethod] = useState("");
  const [special, setSpecial] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  const composed = composeLotName(origin, processMethod, special);
  const nameValue = nameTouched ? name : composed;

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setOrigin("");
      setProcessMethod("");
      setSpecial("");
      setName("");
      setNameTouched(false);
    }
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1">
        <span className={labelClass}>Origin</span>
        <input
          name="origin"
          type="text"
          required
          list="coffee-regions"
          className={inputClass}
          placeholder="Kerinci, Jambi"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
        />
        <datalist id="coffee-regions">
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
          list="varietals"
          className={inputClass}
          placeholder="Gayo 1"
        />
        <datalist id="varietals">
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
          list="process-methods"
          className={inputClass}
          placeholder="Giling Basah"
          value={processMethod}
          onChange={(e) => setProcessMethod(e.target.value)}
        />
        <datalist id="process-methods">
          {suggestions.processMethods.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Kata khusus (opsional)</span>
        <input
          name="special"
          type="text"
          className={inputClass}
          placeholder="Single Var Typica"
          value={special}
          onChange={(e) => setSpecial(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Nama</span>
        <input
          name="name"
          type="text"
          required
          className={inputClass}
          placeholder="Gayo Wine Natural"
          value={nameValue}
          onChange={(e) => {
            setName(e.target.value);
            setNameTouched(true);
          }}
        />
        <span className="font-body text-xs text-ink-faint">
          Terisi otomatis dari Origin, Kata khusus, dan Proses. Boleh diubah.
        </span>
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
