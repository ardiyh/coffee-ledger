/**
 * Business logic layer: aturan main inventory kopi.
 *
 * Ini yang tahu *aturan*: gimana nambah lot, hitung stok, dan validasi. No SQL
 * here — data access is delegated to repository.ts.
 */
import {
  InsufficientStockError,
  InvalidQuantityError,
  InvalidRoastProfileError,
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
  /** Tujuan seduh: Filter, Espresso, atau Omniroast. Set tertutup (lihat
   * ROAST_PROFILES di coffee-vocab.ts), tapi opsional di sini dengan alasan
   * yang sama seperti processMethod di atas. */
  roastProfile?: string | null;
  notes?: string | null;
}

/**
 * Drizzle membungkus error driver Postgres di `error.cause`. `roastProfile`
 * gak divalidasi manual di sini -- constraint "lot_roast_profile_valid" di DB
 * adalah satu-satunya sumber kebenaran soal nilai mana yang sah, jadi
 * errornya cukup diterjemahkan jadi pesan yang ramah (pola yang sama dengan
 * "transaction_stock_nonnegative" di record()).
 */
async function withRoastProfileCheck<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const cause = error instanceof Error && error.cause ? error.cause : error;
    if (typeof cause === "object" && cause !== null &&
        "code" in cause && cause.code === "23514" &&
        "constraint" in cause && cause.constraint === "lot_roast_profile_valid") {
      throw new InvalidRoastProfileError("Profil roast tidak dikenal.");
    }
    throw error;
  }
}

export async function addLot(db: LedgerDb, args: NewLotArgs): Promise<Lot> {
  const newLot: NewLot = {
    name: args.name,
    origin: args.origin,
    varietal: args.varietal,
    processMethod: args.processMethod ?? null,
    roastProfile: args.roastProfile ?? null,
    roastDate: args.roastDate,
    notes: args.notes ?? null,
  };
  return withRoastProfileCheck(() => repo.addLot(db, newLot));
}

export async function updateLot(
  db: LedgerDb,
  lotId: number,
  args: NewLotArgs,
): Promise<Lot> {
  const fields: NewLot = {
    name: args.name,
    origin: args.origin,
    varietal: args.varietal,
    processMethod: args.processMethod ?? null,
    roastProfile: args.roastProfile ?? null,
    roastDate: args.roastDate,
    notes: args.notes ?? null,
  };
  const updated = await withRoastProfileCheck(() => repo.updateLot(db, lotId, fields));
  if (updated === null) {
    throw new LotNotFoundError(`Lot id=${lotId} gak ditemukan`);
  }
  return updated;
}

/** Lot dan ACQUIRE awal disimpan atomik; kegagalan tidak meninggalkan lot kosong. */
export async function addLotWithInitialStock(
  db: LedgerDb,
  args: NewLotArgs,
  initialGrams?: number,
): Promise<Lot> {
  if (initialGrams === undefined) return addLot(db, args);
  validateGrams(initialGrams);
  return repo.addLotWithInitialStock(db, args, initialGrams);
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
  validateGrams(grams);
  if ((await repo.getLot(db, lotId)) === null) {
    throw new LotNotFoundError(`Lot id=${lotId} gak ditemukan`);
  }
  // The database locks the lot and checks its exact numeric balance in the
  // same transaction as the insert. An application-side check would race.
  try {
    return await repo.addTransaction(db, { lotId, kind, reason, grams, note: note ?? null });
  } catch (error) {
    // Drizzle wraps the driver's PostgreSQL error in `cause`.
    const cause = error instanceof Error && error.cause ? error.cause : error;
    if (typeof cause === "object" && cause !== null &&
        "code" in cause && cause.code === "23514" &&
        "constraint" in cause && cause.constraint === "transaction_stock_nonnegative") {
      throw new InsufficientStockError("Stok tidak cukup. Muat ulang untuk melihat saldo terbaru.");
    }
    throw error;
  }
}

function validateGrams(grams: number): void {
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new InvalidQuantityError("Gram harus berupa angka lebih dari nol.");
  }
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
  return repo.currentStock(db, lotId);
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

export type LotValueSuggestions = repo.LotValueSuggestions;

/**
 * Nilai yang pernah dipakai di kolom teks bebas, yang paling sering di depan.
 *
 * Dipakai untuk mengisi `<datalist>` di form tambah lot. Tujuannya bukan cuma
 * mempercepat ketik: menawarkan ejaan yang sudah pernah dipakai menekan
 * penulisan tidak konsisten di sumbernya, yang kalau dibiarkan akan memecah
 * satu varietal jadi dua di analisa nanti.
 */
export async function distinctLotValues(db: LedgerDb): Promise<repo.LotValueSuggestions> {
  return repo.distinctLotValues(db);
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
