/**
 * Business logic layer: aturan main inventory kopi.
 *
 * Ini yang tahu *aturan*: gimana nambah lot, hitung stok, dan validasi. No SQL
 * here — data access is delegated to repository.ts.
 */
import {
  InsufficientStockError,
  InvalidQuantityError,
  LotNotFoundError,
} from "./errors";
import * as repo from "./repository";
import type {
  LedgerDb,
  Lot,
  LotStock,
  NewLot,
  Transaction,
  TxnKind,
  TxnReason,
} from "./repository";

export async function addLot(
  db: LedgerDb,
  args: { name: string; origin: string; varietal: string; roastDate: string; notes?: string | null },
): Promise<Lot> {
  const newLot: NewLot = {
    name: args.name,
    origin: args.origin,
    varietal: args.varietal,
    roastDate: args.roastDate,
    notes: args.notes ?? null,
  };
  return repo.addLot(db, newLot);
}

export async function listLots(db: LedgerDb): Promise<Lot[]> {
  return repo.listLots(db);
}

export async function recordAcquire(
  db: LedgerDb,
  lotId: number,
  grams: number,
  note?: string | null,
): Promise<Transaction> {
  return record(db, lotId, grams, "IN", "ACQUIRE", note);
}

export async function recordBrew(
  db: LedgerDb,
  lotId: number,
  grams: number,
  note?: string | null,
): Promise<Transaction> {
  return record(db, lotId, grams, "OUT", "BREW", note);
}

export async function recordGift(
  db: LedgerDb,
  lotId: number,
  grams: number,
  note?: string | null,
): Promise<Transaction> {
  return record(db, lotId, grams, "OUT", "GIFT", note);
}

/** Koreksi stok manual (mis. tumpah -> OUT, kalibrasi naik -> IN). */
export async function recordAdjust(
  db: LedgerDb,
  lotId: number,
  grams: number,
  kind: TxnKind,
  note?: string | null,
): Promise<Transaction> {
  return record(db, lotId, grams, kind, "ADJUST", note);
}

async function record(
  db: LedgerDb,
  lotId: number,
  grams: number,
  kind: TxnKind,
  reason: TxnReason,
  note?: string | null,
): Promise<Transaction> {
  if (grams <= 0) {
    throw new InvalidQuantityError(`grams harus > 0, dapat ${grams}`);
  }
  if ((await repo.getLot(db, lotId)) === null) {
    throw new LotNotFoundError(`Lot id=${lotId} gak ditemukan`);
  }
  // Deliberately no locking/transaction around this check-then-insert: the
  // stock check and the write are two round trips, so two concurrent writers
  // could in theory overdraw. Accepted: this app is single-user behind a
  // login, so that race can't happen in practice.
  if (kind === "OUT") {
    const stock = await currentStock(db, lotId);
    if (grams > stock) {
      throw new InsufficientStockError(
        `Stok lot ${lotId} cuma ${stock}g, gak bisa keluarin ${grams}g`,
      );
    }
  }
  return repo.addTransaction(db, { lotId, kind, reason, grams, note: note ?? null });
}

/**
 * Habiskan lot: catat koreksi keluar sebesar sisa stoknya.
 *
 * Bukan menghapus. Stok dihitung dari transaksi, jadi menghapus transaksi
 * berarti mengarang ulang sejarah. Lot berstok nol adalah keadaan yang sah.
 *
 * Stok nol ditolak lewat `record()` yang sudah menolak grams <= 0.
 */
export async function finishLot(
  db: LedgerDb,
  lotId: number,
): Promise<Transaction> {
  const stock = await currentStock(db, lotId);
  return recordAdjust(db, lotId, stock, "OUT", "habis");
}

export async function currentStock(db: LedgerDb, lotId: number): Promise<number> {
  const txns = await repo.transactionsFor(db, lotId);
  return txns.reduce((total, t) => total + (t.kind === "IN" ? t.grams : -t.grams), 0);
}

/** Daftar transaksi (semua lot kalau lotId undefined/null), urut kronologis. */
export async function history(db: LedgerDb, lotId?: number | null): Promise<Transaction[]> {
  if (lotId === undefined || lotId === null) {
    return repo.allTransactions(db);
  }
  return repo.transactionsFor(db, lotId);
}

/** Tiap lot beserta stok terkininya (buat dashboard). */
export async function stockSummary(db: LedgerDb): Promise<LotStock[]> {
  return repo.stockSummary(db);
}
