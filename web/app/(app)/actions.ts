"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { LedgerError } from "@/lib/ledger/errors";
import {
  addLot,
  recordAcquire,
  recordBrew,
  recordGift,
  recordAdjust,
} from "@/lib/ledger/service";

/**
 * Shared shape for useActionState: no news is good news (undefined error),
 * `success` flips to true after a write so the form can show a confirmation.
 *
 * Only a type export — a "use server" file may only export async functions
 * (every other export becomes a server action reference), so the
 * `initialActionState` value itself lives in each client form component
 * instead of here.
 */
export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function addLotAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Real auth boundary for this action — a Server Action is a callable HTTP
  // endpoint on its own, so it cannot rely on the page around the form
  // having already checked. See lib/session.ts.
  await requireSession();

  const name = String(formData.get("name") ?? "").trim();
  const origin = String(formData.get("origin") ?? "").trim();
  const varietal = String(formData.get("varietal") ?? "").trim();
  const roastDate = String(formData.get("roastDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name || !origin || !varietal || !roastDate) {
    return { error: "Nama, origin, varietal, dan tanggal roast wajib diisi." };
  }

  try {
    await addLot(db, {
      name,
      origin,
      varietal,
      roastDate,
      notes: notes || null,
    });
  } catch (err) {
    if (err instanceof LedgerError) {
      return { error: err.message };
    }
    throw err;
  }

  // Fresh numbers everywhere a lot list or stock figure is shown.
  revalidatePath("/lots");
  revalidatePath("/record");
  revalidatePath("/");
  return { success: true };
}

type RecordKind = "ACQUIRE" | "BREW" | "GIFT" | "ADJUST_IN" | "ADJUST_OUT";

export async function recordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Real auth boundary for this action — see addLotAction above.
  await requireSession();

  const lotId = Number(formData.get("lotId"));
  const kind = String(formData.get("kind") ?? "") as RecordKind;
  const grams = Number(formData.get("grams"));
  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw || null;

  if (!Number.isFinite(lotId) || lotId <= 0) {
    return { error: "Pilih lot dulu." };
  }
  if (!Number.isFinite(grams)) {
    return { error: "Gram harus berupa angka." };
  }

  try {
    switch (kind) {
      case "ACQUIRE":
        await recordAcquire(db, lotId, grams, note);
        break;
      case "BREW":
        await recordBrew(db, lotId, grams, note);
        break;
      case "GIFT":
        await recordGift(db, lotId, grams, note);
        break;
      case "ADJUST_IN":
        await recordAdjust(db, lotId, grams, "IN", note);
        break;
      case "ADJUST_OUT":
        await recordAdjust(db, lotId, grams, "OUT", note);
        break;
      default:
        return { error: "Aksi gak dikenal." };
    }
  } catch (err) {
    if (err instanceof LedgerError) {
      return { error: err.message };
    }
    throw err;
  }

  // Fresh numbers on the record form itself (stock shown per option),
  // history, and the dashboard.
  revalidatePath("/record");
  revalidatePath("/history");
  revalidatePath("/");
  return { success: true };
}
