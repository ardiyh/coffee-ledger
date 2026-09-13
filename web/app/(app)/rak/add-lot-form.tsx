"use client";

import { useActionState, useState } from "react";
import { addLotAction, type ActionState } from "../actions";
import { composeLotName } from "@/lib/format";
import type { LotSuggestions } from "./types";

const initialActionState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-line bg-panel-2 px-3 py-2 font-body text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

export function AddLotForm({
  todayISO,
  suggestions,
}: {
  todayISO: string;
  suggestions: LotSuggestions;
}) {
  const [origin, setOrigin] = useState("");
  const [processMethod, setProcessMethod] = useState("");
  const [special, setSpecial] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [varietal, setVarietal] = useState("");
  const [roastDate, setRoastDate] = useState(todayISO);
  const [initialGrams, setInitialGrams] = useState("");
  const [notes, setNotes] = useState("");

  const composed = composeLotName(origin, processMethod, special);
  const nameValue = nameTouched ? name : composed;

  // Controlled fields survive React's form reset when the action returns an error.
  async function submit(prevState: ActionState, formData: FormData) {
    const result = await addLotAction(prevState, formData);
    if (result.success) {
      setOrigin("");
      setProcessMethod("");
      setSpecial("");
      setName("");
      setNameTouched(false);
      setVarietal("");
      setRoastDate(todayISO);
      setInitialGrams("");
      setNotes("");
    }
    return result;
  }

  const [state, formAction, pending] = useActionState(
    submit,
    initialActionState,
  );

  return (
    <form action={formAction}>
      <fieldset disabled={pending} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
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
            value={varietal}
            onChange={(event) => setVarietal(event.target.value)}
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
            value={roastDate}
            onChange={(event) => setRoastDate(event.target.value)}
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
            inputMode="decimal"
            value={initialGrams}
            onChange={(event) => setInitialGrams(event.target.value)}
            className={inputClass}
            placeholder="250"
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClass}>Catatan (opsional)</span>
          <textarea
            name="notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={inputClass}
            placeholder="Catatan tambahan..."
          />
        </label>

        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-amber px-5 py-2 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-dim disabled:opacity-50"
          >
            {pending ? "Menyimpan..." : "Tambah lot"}
          </button>
          {state.error ? (
            <p className="font-body text-sm text-clay-ink" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="font-body text-sm text-teal" role="status">Lot ditambahkan.</p>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}
