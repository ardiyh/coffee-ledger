"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordAction, type ActionState } from "../actions";
import { daysSince, formatGrams } from "@/lib/format";
import { FinishLotButton } from "./finish-lot-button";

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
  stock: number;
}

export function LotRow({
  lotId,
  name,
  origin,
  varietal,
  processMethod,
  roastDate,
  stock,
}: LotRowProps) {
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
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
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
          {stock > 0 ? (
            <FinishLotButton
              lotId={lotId}
              lotName={name}
              grams={formatGrams(stock)}
            />
          ) : null}
        </div>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4"
      >
        <input type="hidden" name="lotId" value={lotId} />

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
            className={`${inputClass} w-24`}
            placeholder="250"
          />
        </label>

        <label className="flex flex-1 min-w-[10rem] flex-col gap-1">
          <span className={labelClass}>Catatan (opsional)</span>
          <input
            name="note"
            type="text"
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
          <p className="w-full font-body text-sm text-clay" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="w-full font-body text-sm text-teal">Tercatat.</p>
        ) : null}
      </form>
    </div>
  );
}
