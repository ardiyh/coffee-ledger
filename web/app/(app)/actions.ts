"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { LedgerError } from "@/lib/ledger/errors";
import type { Transaction } from "@/lib/ledger/repository";
import {
  addLotWithInitialStock,
  recordAcquire,
  recordBrew,
  recordGift,
  recordAdjust,
  updateLot,
} from "@/lib/ledger/service";

/**
 * What actually got written -- lets the UI say what was recorded, on which
 * lot, and how much, instead of a bare "it worked". Shaped directly from the
 * `Transaction` the service layer already returns from a successful record*
 * call; nothing here is computed or re-queried.
 */
export interface TransactionReceipt {
  id: number;
  lotId: number;
  kind: "IN" | "OUT";
  reason: "ACQUIRE" | "BREW" | "GIFT" | "ADJUST";
  grams: number;
}

/**
 * Shared shape for useActionState: no news is good news (undefined error),
 * `success` flips to true after a write so the form can show a confirmation.
 * `receipt` is only ever populated by recordAction -- addLotAction and
 * editLotAction don't produce a transaction, so they never set it.
 *
 * Only a type export — a "use server" file may only export async functions
 * (every other export becomes a server action reference), so the
 * `initialActionState` value itself lives in each client form component
 * instead of here.
 */
export interface ActionState {
  error?: string;
  success?: boolean;
  receipt?: TransactionReceipt;
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
  const processMethod = String(formData.get("processMethod") ?? "").trim();
  const roastProfile = String(formData.get("roastProfile") ?? "").trim();
  const roastDate = String(formData.get("roastDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name || !origin || !varietal || !processMethod || !roastProfile || !roastDate) {
    return {
      error: "Nama, origin, varietal, proses, profil roast, dan tanggal roast wajib diisi.",
    };
  }

  const initialGramsRaw = String(formData.get("initialGrams") ?? "").trim();
  const initialGrams = initialGramsRaw === "" ? undefined : Number(initialGramsRaw);

  if (initialGrams !== undefined && !Number.isFinite(initialGrams)) {
    return { error: "Gram awal harus berupa angka." };
  }

  try {
    await addLotWithInitialStock(
      db,
      { name, origin, varietal, processMethod, roastProfile, roastDate, notes: notes || null },
      initialGrams,
    );
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }

  // Fresh numbers everywhere a lot list or stock figure is shown.
  revalidatePath("/rak");
  revalidatePath("/history");
  revalidatePath("/dashboard");
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

  // Populated by every branch below except `default`, which returns before
  // reaching the code that reads it.
  let txn: Transaction;

  try {
    switch (kind) {
      case "ACQUIRE":
        txn = await recordAcquire(db, lotId, grams, note);
        break;
      case "BREW":
        txn = await recordBrew(db, lotId, grams, note);
        break;
      case "GIFT":
        txn = await recordGift(db, lotId, grams, note);
        break;
      case "ADJUST_IN":
        txn = await recordAdjust(db, lotId, grams, "IN", note);
        break;
      case "ADJUST_OUT":
        txn = await recordAdjust(db, lotId, grams, "OUT", note);
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

  // Fresh numbers on Rak's rows, history, and the dashboard.
  revalidatePath("/rak");
  revalidatePath("/history");
  revalidatePath("/dashboard");

  // Shaped straight from the transaction the write above already returned --
  // no extra query after commit that could turn a successful write into a
  // reported failure just because a follow-up read failed.
  return {
    success: true,
    receipt: {
      id: txn.id,
      lotId: txn.lotId,
      kind: txn.kind,
      reason: txn.reason,
      grams: txn.grams,
    },
  };
}

export async function editLotAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Real auth boundary for this action — see addLotAction above.
  await requireSession();

  const lotId = Number(formData.get("lotId"));
  const name = String(formData.get("name") ?? "").trim();
  const origin = String(formData.get("origin") ?? "").trim();
  const varietal = String(formData.get("varietal") ?? "").trim();
  const processMethod = String(formData.get("processMethod") ?? "").trim();
  const roastProfile = String(formData.get("roastProfile") ?? "").trim();
  const roastDate = String(formData.get("roastDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!Number.isFinite(lotId) || lotId <= 0) {
    return { error: "Lot gak dikenal." };
  }
  if (!name || !origin || !varietal || !processMethod || !roastProfile || !roastDate) {
    return {
      error: "Nama, origin, varietal, proses, profil roast, dan tanggal roast wajib diisi.",
    };
  }

  try {
    await updateLot(db, lotId, {
      name,
      origin,
      varietal,
      processMethod,
      roastProfile,
      roastDate,
      notes: notes || null,
    });
  } catch (err) {
    if (err instanceof LedgerError) return { error: err.message };
    throw err;
  }

  // Fresh numbers/names on Rak's rows, history, and the dashboard.
  revalidatePath("/rak");
  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { success: true };
}
