"use client";

import { useActionState } from "react";
import { finishLotAction, type ActionState } from "../actions";

const initialActionState: ActionState = {};

export function FinishLotButton({
  lotId,
  lotName,
  grams,
}: {
  lotId: number;
  lotName: string;
  grams: string;
}) {
  const [state, formAction, pending] = useActionState(
    finishLotAction,
    initialActionState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // Penulisan ini gak bisa dibatalkan dengan satu klik lagi, jadi
        // konfirmasinya menyebut jumlah gramnya secara eksplisit.
        if (
          !confirm(
            `Habiskan "${lotName}"? Ini mencatat koreksi keluar ${grams} dan gak bisa dibatalkan otomatis.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="lotId" value={lotId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-line px-3 py-1 font-body text-xs text-ink-dim transition-colors hover:border-clay hover:text-clay disabled:opacity-50"
      >
        {pending ? "..." : "Habiskan"}
      </button>
      {state.error ? (
        <p className="mt-1 font-body text-xs text-clay" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
