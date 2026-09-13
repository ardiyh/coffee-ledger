"use client";

import { useActionState, useState } from "react";
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
  roastDate: string;
  notes: string | null;
  stock: number;
  suggestions: LotSuggestions;
}

export function LotRow({
  lotId,
  name,
  origin,
  varietal,
  processMethod,
  roastDate,
  notes,
  stock,
  suggestions,
}: LotRowProps) {
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

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      {editing ? (
        <EditLotForm
          lotId={lotId}
          initial={{ name, origin, varietal, processMethod, roastDate, notes }}
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
              {daysSince(roastDate)} hari sejak roast
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="font-mono text-lg tabular-nums text-ink">
              {formatGrams(stock)}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full border border-line px-3 py-1 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber"
            >
              Edit
            </button>
          </div>
        </div>
      )}

      <form
        action={formAction}
        className="mt-4 border-t border-line pt-4"
      >
        <fieldset disabled={pending} className="flex min-w-0 flex-wrap items-end gap-3">
          <input type="hidden" name="lotId" value={lotId} />

          <label className="flex flex-col gap-1">
            <span className={labelClass}>Aksi</span>
            <select
              name="kind"
              required
              value={kind ?? (stock > 0 ? "BREW" : "ACQUIRE")}
              onChange={(event) => setKind(event.target.value)}
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
              value={grams}
              onChange={(event) => setGrams(event.target.value)}
              className={`${inputClass} w-24`}
              placeholder={stock > 0 ? "18" : "250"}
            />
          </label>

          <label className="flex flex-1 min-w-[10rem] flex-col gap-1">
            <span className={labelClass}>Catatan (opsional)</span>
            <input
              name="note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={inputClass}
              placeholder="Catatan tambahan..."
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-amber px-5 py-2 font-body text-sm font-semibold text-ground transition-colors hover:bg-amber-dim disabled:opacity-50"
          >
            {pending ? "Menyimpan..." : "Catat"}
          </button>

          {state.error ? (
            <p className="w-full font-body text-sm text-clay-ink" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="w-full font-body text-sm text-teal" role="status">Tercatat.</p>
          ) : null}
        </fieldset>
      </form>
    </div>
  );
}
