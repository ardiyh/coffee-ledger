import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import * as relations from "./relations";
import type { LedgerDb, Lot } from "./repository";
import * as schema from "./schema";
import {
  InsufficientStockError,
  InvalidQuantityError,
  LotNotFoundError,
} from "./errors";
import * as service from "./service";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DDL_PATH = path.resolve(__dirname, "../../drizzle/0000_simple_madame_masque.sql");

/**
 * A fresh, empty PGlite database per test — mirrors the Python conftest.py
 * fixture that builds a new in-memory SQLite db per test. Schema comes from
 * the drizzle-kit-generated DDL (drizzle/0000_simple_madame_masque.sql), not
 * hand-written CREATE TABLEs, so there's one source of truth for the shape.
 * That file is wrapped in a /* ... *\/ block (introspect output, so it can't
 * accidentally be replayed against the real database) — strip the wrapper,
 * split on the statement-breakpoint markers, and run each statement.
 */
async function freshDb(): Promise<LedgerDb> {
  const client = new PGlite();
  const db: LedgerDb = drizzle(client, { schema: { ...schema, ...relations } });

  const raw = readFileSync(DDL_PATH, "utf-8");
  const match = raw.match(/\/\*([\s\S]*)\*\//);
  if (!match) {
    throw new Error(`Expected ${DDL_PATH} to contain a /* ... */ wrapped block`);
  }
  const statements = match[1]
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await client.exec(statement);
  }
  return db;
}

function sampleLot(db: LedgerDb): Promise<Lot> {
  return service.addLot(db, {
    name: "Gayo Bener Kelipah",
    origin: "Gayo, Aceh",
    varietal: "Red Bourbon",
    roastDate: "2026-06-20",
  });
}

async function twoLots(db: LedgerDb) {
  const a = await service.addLot(db, {
    name: "A",
    origin: "Gayo",
    varietal: "RB",
    roastDate: "2026-06-01",
  });
  const b = await service.addLot(db, {
    name: "B",
    origin: "Toraja",
    varietal: "Typica",
    roastDate: "2026-06-02",
  });
  return { a, b };
}

describe("ledger", () => {
  let db: LedgerDb;

  beforeEach(async () => {
    db = await freshDb();
  });

  // --- test_service.py ---

  it("add lot then it appears in the list", async () => {
    const lot = await sampleLot(db);
    expect(lot.id).not.toBeNull();

    const lots = await service.listLots(db);
    expect(lots).toHaveLength(1);
    expect(lots[0].name).toBe("Gayo Bener Kelipah");
    expect(lots[0].varietal).toBe("Red Bourbon");
  });

  it("acquire increases stock", async () => {
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 250);

    expect(await service.currentStock(db, lot.id)).toBe(250);
  });

  it("brew decreases stock", async () => {
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 250);
    await service.recordBrew(db, lot.id, 18);

    expect(await service.currentStock(db, lot.id)).toBe(232);
  });

  it("gift decreases stock", async () => {
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 250);
    await service.recordGift(db, lot.id, 50);

    expect(await service.currentStock(db, lot.id)).toBe(200);
  });

  it("stock is net of all transactions", async () => {
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 250);
    await service.recordAcquire(db, lot.id, 100);
    await service.recordBrew(db, lot.id, 18);
    await service.recordGift(db, lot.id, 30);

    expect(await service.currentStock(db, lot.id)).toBe(302);
  });

  it("note is saved on transaction", async () => {
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 100, "beli dari roastery");
    await service.recordBrew(db, lot.id, 18, "V60");

    const notes = (await service.history(db, lot.id)).map((t) => t.note);
    expect(notes).toEqual(["beli dari roastery", "V60"]);
  });

  // --- test_validation.py ---

  it("cannot brew more than stock", async () => {
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 100);

    await expect(service.recordBrew(db, lot.id, 150)).rejects.toThrow(
      InsufficientStockError,
    );
    expect(await service.currentStock(db, lot.id)).toBe(100); // stok gak boleh berubah
  });

  it("cannot gift more than stock", async () => {
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 50);

    await expect(service.recordGift(db, lot.id, 60)).rejects.toThrow(
      InsufficientStockError,
    );
  });

  it("grams must be positive", async () => {
    const lot = await sampleLot(db);
    await expect(service.recordAcquire(db, lot.id, 0)).rejects.toThrow(
      InvalidQuantityError,
    );
    await expect(service.recordAcquire(db, lot.id, -5)).rejects.toThrow(
      InvalidQuantityError,
    );
  });

  it("recording for unknown lot raises", async () => {
    await expect(service.recordAcquire(db, 999, 10)).rejects.toThrow(
      LotNotFoundError,
    );
  });

  it("adjust can increase and decrease stock", async () => {
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 100);

    await service.recordAdjust(db, lot.id, 5, "OUT"); // tumpah 5g
    expect(await service.currentStock(db, lot.id)).toBe(95);

    await service.recordAdjust(db, lot.id, 3, "IN"); // kalibrasi +3
    expect(await service.currentStock(db, lot.id)).toBe(98);
  });

  // --- test_reads.py ---

  it("history returns transactions in chronological order", async () => {
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 250);
    await service.recordBrew(db, lot.id, 18);

    const history = await service.history(db, lot.id);

    expect(history.map((t) => t.reason)).toEqual(["ACQUIRE", "BREW"]);
    expect(history.map((t) => t.grams)).toEqual([250, 18]);
  });

  it("history without lot returns all lots", async () => {
    const { a, b } = await twoLots(db);
    await service.recordAcquire(db, a.id, 100);
    await service.recordAcquire(db, b.id, 200);

    expect(await service.history(db)).toHaveLength(2);
  });

  it("stock summary lists each lot with its stock", async () => {
    const { a, b } = await twoLots(db);
    await service.recordAcquire(db, a.id, 100);
    await service.recordBrew(db, a.id, 30);
    await service.recordAcquire(db, b.id, 200);

    const summary = await service.stockSummary(db);
    const byName = Object.fromEntries(summary.map((s) => [s.lot.name, s.stock]));

    expect(byName).toEqual({ A: 70, B: 200 });
  });
});

describe("finishLot", () => {
  it("mencatat koreksi keluar sebesar sisa stok", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 250);

    await service.finishLot(db, lot.id);

    expect(await service.currentStock(db, lot.id)).toBe(0);
    const txns = await service.history(db, lot.id);
    const last = txns[txns.length - 1];
    expect(last.kind).toBe("OUT");
    expect(last.reason).toBe("ADJUST");
    expect(last.grams).toBe(250);
    expect(last.note).toBe("habis");
  });

  it("riwayat tetap utuh, tidak ada yang dihapus", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 250);
    await service.recordBrew(db, lot.id, 18);

    await service.finishLot(db, lot.id);

    expect((await service.history(db, lot.id)).length).toBe(3);
  });

  it("menolak lot yang stoknya sudah nol", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);

    await expect(service.finishLot(db, lot.id)).rejects.toThrow(
      InvalidQuantityError,
    );
  });
});
