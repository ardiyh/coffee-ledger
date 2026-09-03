import { readFileSync, readdirSync } from "node:fs";
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
import { composeLotName, daysSince } from "../format";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = path.resolve(__dirname, "../../drizzle");

/**
 * A fresh, empty PGlite database per test — mirrors the Python conftest.py
 * fixture that built a new in-memory SQLite db per test.
 *
 * Schema comes from the drizzle-kit-generated migration files under drizzle/,
 * applied in filename order, so there is one source of truth for the shape and
 * a test can never drift from what the real database actually has.
 */
async function freshDb(): Promise<LedgerDb> {
  const client = new PGlite();
  const db: LedgerDb = drizzle(client, { schema: { ...schema, ...relations } });

  const migrations = readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (migrations.length === 0) {
    throw new Error(`No .sql migrations found in ${DRIZZLE_DIR}`);
  }

  for (const file of migrations) {
    const statements = readFileSync(path.resolve(DRIZZLE_DIR, file), "utf-8")
      .split("--> statement-breakpoint")
      .map((stmt) => stmt.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await client.exec(statement);
    }
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

describe("addLotWithInitialStock", () => {
  const args = {
    name: "Gayo Bener Kelipah",
    origin: "Gayo, Aceh",
    varietal: "Red Bourbon",
    roastDate: "2026-06-20",
  };

  it("tanpa gram awal: lot dibuat, stok nol, tanpa transaksi", async () => {
    const db = await freshDb();

    const lot = await service.addLotWithInitialStock(db, args);

    expect(lot.id).toBeDefined();
    expect(await service.currentStock(db, lot.id)).toBe(0);
    expect((await service.history(db, lot.id)).length).toBe(0);
  });

  it("dengan gram awal: stok langsung terisi lewat satu ACQUIRE", async () => {
    const db = await freshDb();

    const lot = await service.addLotWithInitialStock(db, args, 250);

    expect(await service.currentStock(db, lot.id)).toBe(250);
    const txns = await service.history(db, lot.id);
    expect(txns.length).toBe(1);
    expect(txns[0].reason).toBe("ACQUIRE");
    expect(txns[0].grams).toBe(250);
  });

  it("gram awal nol ditolak, tapi lot-nya tetap terbuat", async () => {
    const db = await freshDb();

    await expect(service.addLotWithInitialStock(db, args, 0)).rejects.toThrow(
      InvalidQuantityError,
    );

    const lots = await service.listLots(db);
    expect(lots.length).toBe(1);
    expect(await service.currentStock(db, lots[0].id)).toBe(0);
  });
});

describe("processMethod", () => {
  const args = {
    name: "Gayo Wine",
    origin: "Gayo, Aceh",
    varietal: "Typica",
    roastDate: "2026-09-01",
  };

  it("tersimpan waktu diberikan", async () => {
    const db = await freshDb();
    const lot = await service.addLot(db, { ...args, processMethod: "Giling Basah" });

    const stored = (await service.listLots(db)).find((l) => l.id === lot.id);
    expect(stored?.processMethod).toBe("Giling Basah");
  });

  it("null waktu tidak diberikan", async () => {
    const db = await freshDb();
    const lot = await service.addLot(db, args);

    const stored = (await service.listLots(db)).find((l) => l.id === lot.id);
    expect(stored?.processMethod).toBeNull();
  });
});

describe("outflowByReason", () => {
  it("hanya menghitung transaksi OUT, ACQUIRE diabaikan", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 1000);
    await service.recordBrew(db, lot.id, 60);
    await service.recordGift(db, lot.id, 240);

    const rows = await service.outflowByReason(db);

    expect(rows).toEqual([
      { reason: "GIFT", grams: 240 },
      { reason: "BREW", grams: 60 },
    ]);
  });

  it("urut menurun berdasarkan gram", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 500);
    await service.recordBrew(db, lot.id, 100);
    await service.recordGift(db, lot.id, 50);
    await service.recordAdjust(db, lot.id, 200, "OUT");

    expect((await service.outflowByReason(db)).map((r) => r.reason)).toEqual([
      "ADJUST",
      "BREW",
      "GIFT",
    ]);
  });

  it("database kosong menghasilkan array kosong", async () => {
    expect(await service.outflowByReason(await freshDb())).toEqual([]);
  });
});

describe("giftsByRecipient", () => {
  it("mengelompokkan catatan GIFT, tidak peka spasi dan besar-kecil huruf", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 1000);
    await service.recordGift(db, lot.id, 100, "Hapis");
    await service.recordGift(db, lot.id, 50, " hapis ");
    await service.recordGift(db, lot.id, 80, "Grey");

    expect(await service.giftsByRecipient(db)).toEqual([
      { recipient: "Hapis", grams: 150 },
      { recipient: "Grey", grams: 80 },
    ]);
  });

  it("catatan kosong masuk kelompok tanpa catatan", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 200);
    await service.recordGift(db, lot.id, 30);

    expect(await service.giftsByRecipient(db)).toEqual([
      { recipient: "(tanpa catatan)", grams: 30 },
    ]);
  });

  it("BREW dan ACQUIRE tidak ikut terhitung", async () => {
    const db = await freshDb();
    const lot = await sampleLot(db);
    await service.recordAcquire(db, lot.id, 500, "beli");
    await service.recordBrew(db, lot.id, 20, "V60");

    expect(await service.giftsByRecipient(db)).toEqual([]);
  });
});

describe("distinctLotValues", () => {
  const base = { name: "x", origin: "Gayo, Aceh", varietal: "Typica", roastDate: "2026-09-01" };

  it("mengembalikan nilai unik, yang paling sering di depan", async () => {
    const db = await freshDb();
    await service.addLot(db, { ...base, varietal: "Typica" });
    await service.addLot(db, { ...base, varietal: "Ateng" });
    await service.addLot(db, { ...base, varietal: "Typica" });

    const v = await service.distinctLotValues(db);
    expect(v.varietals).toEqual(["Typica", "Ateng"]);
    expect(v.origins).toEqual(["Gayo, Aceh"]);
  });

  it("melewati processMethod yang null", async () => {
    const db = await freshDb();
    await service.addLot(db, base);
    await service.addLot(db, { ...base, processMethod: "Giling Basah" });

    expect((await service.distinctLotValues(db)).processMethods).toEqual(["Giling Basah"]);
  });

  it("database kosong menghasilkan tiga array kosong", async () => {
    expect(await service.distinctLotValues(await freshDb())).toEqual({
      origins: [], varietals: [], processMethods: [],
    });
  });
});

describe("daysSince", () => {
  it("menghitung selisih hari kalender", () => {
    expect(daysSince("2026-06-18", new Date("2026-09-03T00:00:00+07:00"))).toBe(77);
  });

  it("hari ini nol", () => {
    expect(daysSince("2026-09-03", new Date("2026-09-03T23:00:00+07:00"))).toBe(0);
  });

  it("tanggal besok negatif, bukan dilempar", () => {
    expect(daysSince("2026-09-04", new Date("2026-09-03T10:00:00+07:00"))).toBe(-1);
  });
});

describe("composeLotName", () => {
  it("menggabungkan bentuk pendek origin dengan proses", () => {
    expect(composeLotName("Gayo, Aceh", "Wine")).toBe("Gayo Wine");
    expect(composeLotName("Kerinci, Jambi", "Natural Anaerob")).toBe(
      "Kerinci Natural Anaerob",
    );
  });

  it("menyelipkan kata khusus di antara origin dan proses", () => {
    expect(
      composeLotName("Gayo, Aceh", "Darkroom Natural Anaerob 48H", "Single Var Typica"),
    ).toBe("Gayo Single Var Typica Darkroom Natural Anaerob 48H");
  });

  it("origin tanpa koma dipakai apa adanya", () => {
    expect(composeLotName("Toraja", "Washed")).toBe("Toraja Washed");
  });

  it("bagian kosong dilewati dan spasi berlebih dirapikan", () => {
    expect(composeLotName("  Gayo, Aceh  ", "  Wine  ", "   ")).toBe("Gayo Wine");
    expect(composeLotName("", "Washed")).toBe("Washed");
    expect(composeLotName("Gayo, Aceh", "")).toBe("Gayo");
  });
});
