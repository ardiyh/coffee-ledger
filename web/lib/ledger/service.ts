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

export interface NewLotArgs {
  name: string;
  origin: string;
  varietal: string;
  roastDate: string;
  /**
   * Proses pasca panen: Natural, Washed, Giling Basah, dan seterusnya.
   *
   * Opsional di sini walaupun form mewajibkannya. Database mengizinkan null
   * supaya data yang masuk lewat jalur lain (impor, skrip) tidak perlu
   * mengarang nilai untuk sesuatu yang memang tidak diketahui.
   */
  processMethod?: string | null;
  notes?: string | null;
}

export async function addLot(db: LedgerDb, args: NewLotArgs): Promise<Lot> {
  const newLot: NewLot = {
    name: args.name,
    origin: args.origin,
    varietal: args.varietal,
    processMethod: args.processMethod ?? null,
    roastDate: args.roastDate,
    notes: args.notes ?? null,
  };
  return repo.addLot(db, newLot);
}

/**
 * Buat lot, dan kalau gram awal diberikan, catat sekalian ACQUIRE-nya.
 *
 * Sengaja tanpa rollback: kalau ACQUIRE gagal setelah lot terbuat, lot tetap
 * ada dengan stok nol. Membuat lot dan mencatat transaksi adalah dua fakta
 * terpisah di buku besar, dan lot berstok nol itu keadaan yang sah.
 *
 * `initialGrams` yang <= 0 ditolak oleh `record()`, bukan diabaikan diam-diam.
 * Form mengirim `undefined` kalau kolomnya dikosongkan.
 */
export async function addLotWithInitialStock(
  db: LedgerDb,
  args: NewLotArgs,
  initialGrams?: number,
): Promise<Lot> {
  const lot = await addLot(db, args);
  if (initialGrams !== undefined) {
    await recordAcquire(db, lot.id, initialGrams, "stok awal");
  }
  return lot;
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

export type OutflowRow = repo.OutflowRow;
export type RecipientRow = repo.RecipientRow;

/**
 * Gram yang keluar, dikelompokkan per alasan, urut menurun.
 *
 * Hanya transaksi OUT. ACQUIRE sengaja tidak ikut: yang masuk dan yang keluar
 * bukan bagian dari satu keseluruhan, jadi menampilkannya bersama akan berbohong
 * tentang proporsi.
 */
export async function outflowByReason(db: LedgerDb): Promise<repo.OutflowRow[]> {
  return repo.outflowByReason(db);
}

/**
 * Gram hadiah per penerima, dibaca dari kolom catatan.
 *
 * Ini heuristik atas teks bebas: catatan pada transaksi GIFT kebetulan berisi nama
 * orang. Pengelompokan memangkas spasi dan mengabaikan besar-kecil huruf, lalu
 * menampilkan ejaan yang pertama kali muncul. Kalau penulisan nama nanti terlalu
 * beragam sampai hasilnya berantakan, itu sinyal bahwa penerima layak jadi kolom
 * sendiri, bukan alasan menambah kolom sekarang.
 */
export async function giftsByRecipient(db: LedgerDb): Promise<repo.RecipientRow[]> {
  return repo.giftsByRecipient(db);
}
