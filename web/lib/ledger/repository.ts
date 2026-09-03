/**
 * Persistence layer: raw access ke Lot & Transaction lewat Drizzle.
 *
 * Layer ini cuma tahu cara *menyimpan & mengambil* data. Aturan bisnis (hitung
 * stok, validasi) ada di service.ts.
 *
 * Functions take the `db` handle as their first argument (not a class) — keeps
 * this injectable for tests (PGlite) without a DI container.
 */
import { asc, eq, sql as rawSql, sum } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { lot, transaction } from "./schema";

/** Any Postgres-flavored Drizzle db (neon-http in prod, pglite in tests). */
export type LedgerDb = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

export type TxnKind = "IN" | "OUT";
export type TxnReason = "ACQUIRE" | "BREW" | "GIFT" | "ADJUST";

export interface Lot {
  id: number;
  name: string;
  origin: string;
  varietal: string;
  processMethod: string | null;
  /** YYYY-MM-DD. Left as a string — it's a date-only value, so turning it into
   * a JS Date would tie it to a timezone it doesn't have. */
  roastDate: string;
  createdAt: Date;
  notes: string | null;
}

export interface Transaction {
  id: number;
  lotId: number;
  ts: Date;
  kind: TxnKind;
  reason: TxnReason;
  grams: number;
  note: string | null;
}

export interface NewLot {
  name: string;
  origin: string;
  varietal: string;
  processMethod?: string | null;
  roastDate: string;
  notes?: string | null;
}

export interface NewTransaction {
  lotId: number;
  kind: TxnKind;
  reason: TxnReason;
  grams: number;
  note?: string | null;
}

// schema.ts has `mode: 'string'` on all timestamps, so Drizzle hands rows back
// with string timestamps. Convert to Date here, at the repository boundary, so
// everything above (service.ts, callers) works with real Date objects.
function mapLot(row: typeof lot.$inferSelect): Lot {
  return {
    id: row.id,
    name: row.name,
    origin: row.origin,
    varietal: row.varietal,
    processMethod: row.processMethod,
    roastDate: row.roastDate,
    createdAt: new Date(row.createdAt),
    notes: row.notes,
  };
}

function mapTransaction(row: typeof transaction.$inferSelect): Transaction {
  return {
    id: row.id,
    lotId: row.lotId,
    ts: new Date(row.ts),
    kind: row.kind as TxnKind,
    reason: row.reason as TxnReason,
    grams: row.grams,
    note: row.note,
  };
}

export async function addLot(db: LedgerDb, newLot: NewLot): Promise<Lot> {
  const [row] = await db
    .insert(lot)
    .values({
      name: newLot.name,
      origin: newLot.origin,
      varietal: newLot.varietal,
      processMethod: newLot.processMethod ?? null,
      roastDate: newLot.roastDate,
      createdAt: new Date().toISOString(),
      notes: newLot.notes ?? null,
    })
    .returning();
  return mapLot(row);
}

export async function getLot(db: LedgerDb, lotId: number): Promise<Lot | null> {
  const [row] = await db.select().from(lot).where(eq(lot.id, lotId));
  return row ? mapLot(row) : null;
}

export async function listLots(db: LedgerDb): Promise<Lot[]> {
  const rows = await db.select().from(lot);
  return rows.map(mapLot);
}

export async function addTransaction(
  db: LedgerDb,
  newTxn: NewTransaction,
): Promise<Transaction> {
  const [row] = await db
    .insert(transaction)
    .values({
      lotId: newTxn.lotId,
      ts: new Date().toISOString(),
      kind: newTxn.kind,
      reason: newTxn.reason,
      grams: newTxn.grams,
      note: newTxn.note ?? null,
    })
    .returning();
  return mapTransaction(row);
}

export async function transactionsFor(db: LedgerDb, lotId: number): Promise<Transaction[]> {
  const rows = await db
    .select()
    .from(transaction)
    .where(eq(transaction.lotId, lotId))
    .orderBy(asc(transaction.ts), asc(transaction.id));
  return rows.map(mapTransaction);
}

export async function allTransactions(db: LedgerDb): Promise<Transaction[]> {
  const rows = await db
    .select()
    .from(transaction)
    .orderBy(asc(transaction.ts), asc(transaction.id));
  return rows.map(mapTransaction);
}

export interface LotStock {
  lot: Lot;
  stock: number;
}

/**
 * Every lot with its current stock, in ONE aggregate query — a grouped sum,
 * left-joined so lots with zero transactions still come back with stock 0.
 * (The Python original loops calling current_stock per lot, an N+1; fixing
 * that here is one of the reasons for this port.)
 */
export async function stockSummary(db: LedgerDb): Promise<LotStock[]> {
  const stockExpr = rawSql<string>`coalesce(sum(case when ${transaction.kind} = 'IN' then ${transaction.grams} else -${transaction.grams} end), 0)`;
  const rows = await db
    .select({ lot, stock: stockExpr })
    .from(lot)
    .leftJoin(transaction, eq(transaction.lotId, lot.id))
    .groupBy(lot.id);
  return rows.map((r) => ({ lot: mapLot(r.lot), stock: Number(r.stock) }));
}

export interface LotValueSuggestions {
  origins: string[];
  varietals: string[];
  processMethods: string[];
}

/** Nilai origin/varietal/processMethod yang pernah dipakai, paling sering di depan. */
export async function distinctLotValues(db: LedgerDb): Promise<LotValueSuggestions> {
  const rows = await db
    .select({
      origin: lot.origin,
      varietal: lot.varietal,
      processMethod: lot.processMethod,
    })
    .from(lot);

  const rank = (values: (string | null)[]) => {
    const count = new Map<string, number>();
    for (const v of values) {
      const s = (v ?? "").trim();
      if (s) count.set(s, (count.get(s) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
  };

  return {
    origins: rank(rows.map((r) => r.origin)),
    varietals: rank(rows.map((r) => r.varietal)),
    processMethods: rank(rows.map((r) => r.processMethod)),
  };
}

export interface OutflowRow { reason: TxnReason; grams: number; }
export interface RecipientRow { recipient: string; grams: number; }

export async function outflowByReason(db: LedgerDb): Promise<OutflowRow[]> {
  const rows = await db
    .select({ reason: transaction.reason, grams: sum(transaction.grams) })
    .from(transaction)
    .where(eq(transaction.kind, "OUT"))
    .groupBy(transaction.reason);
  return rows
    .map((r) => ({ reason: r.reason, grams: Number(r.grams) }))
    .sort((a, b) => b.grams - a.grams);
}

export async function giftsByRecipient(db: LedgerDb): Promise<RecipientRow[]> {
  const rows = await db
    .select({ note: transaction.note, grams: transaction.grams })
    .from(transaction)
    .where(eq(transaction.reason, "GIFT"));

  const byKey = new Map<string, RecipientRow>();
  for (const r of rows) {
    const label = (r.note ?? "").trim() || "(tanpa catatan)";
    const key = label.toLowerCase();
    const existing = byKey.get(key);
    if (existing) existing.grams += r.grams;
    else byKey.set(key, { recipient: label, grams: r.grams });
  }
  return [...byKey.values()].sort((a, b) => b.grams - a.grams);
}
