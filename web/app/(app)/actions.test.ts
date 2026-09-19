import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Plain unit tests of recordAction's own logic: session/service/db are all
// mocked out, so nothing here touches a real database or Next.js request
// context. DB-backed behavior (actual stock math, ledger invariants) is
// covered with real Postgres in lib/ledger/ledger.test.ts.
vi.mock("@/lib/session", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/ledger/service", () => ({
  recordAcquire: vi.fn(),
  recordBrew: vi.fn(),
  recordGift: vi.fn(),
  recordAdjust: vi.fn(),
  addLotWithInitialStock: vi.fn(),
  updateLot: vi.fn(),
}));

import { recordAction } from "./actions";
import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { recordAcquire, recordBrew, recordGift, recordAdjust } from "@/lib/ledger/service";
import { InsufficientStockError } from "@/lib/ledger/errors";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

afterEach(() => vi.resetAllMocks());

describe("recordAction receipt", () => {
  it("kegagalan tidak menghasilkan receipt", async () => {
    vi.mocked(recordBrew).mockRejectedValue(new InsufficientStockError("Stok tidak cukup."));

    const result = await recordAction(
      {},
      formData({ lotId: "1", kind: "BREW", grams: "50", note: "" }),
    );

    expect(result.error).toBe("Stok tidak cukup.");
    expect(result.success).toBeUndefined();
    expect(result.receipt).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("keberhasilan membawa id, lotId, kind, reason, dan gram persis dari hasil service", async () => {
    vi.mocked(recordAcquire).mockResolvedValue({
      id: 42,
      lotId: 7,
      ts: new Date("2026-09-19T00:00:00Z"),
      kind: "IN",
      reason: "ACQUIRE",
      grams: 250,
      note: "dari toko",
    });

    const result = await recordAction(
      {},
      formData({ lotId: "7", kind: "ACQUIRE", grams: "250", note: "dari toko" }),
    );

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.receipt).toEqual({
      id: 42,
      lotId: 7,
      kind: "IN",
      reason: "ACQUIRE",
      grams: 250,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/rak");
    expect(revalidatePath).toHaveBeenCalledWith("/history");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("dua sukses berturut-turut membawa receipt dengan ID yang berbeda", async () => {
    vi.mocked(recordBrew)
      .mockResolvedValueOnce({
        id: 1, lotId: 1, ts: new Date(), kind: "OUT", reason: "BREW", grams: 18, note: null,
      })
      .mockResolvedValueOnce({
        id: 2, lotId: 1, ts: new Date(), kind: "OUT", reason: "BREW", grams: 20, note: null,
      });

    const first = await recordAction({}, formData({ lotId: "1", kind: "BREW", grams: "18", note: "" }));
    const second = await recordAction({}, formData({ lotId: "1", kind: "BREW", grams: "20", note: "" }));

    expect(first.receipt?.id).toBe(1);
    expect(second.receipt?.id).toBe(2);
    expect(first.receipt?.id).not.toBe(second.receipt?.id);
  });

  it("GIFT tanpa penerima tetap tercatat, note null di receipt tidak memengaruhi bentuk receipt", async () => {
    vi.mocked(recordGift).mockResolvedValue({
      id: 5, lotId: 3, ts: new Date(), kind: "OUT", reason: "GIFT", grams: 100, note: null,
    });

    const result = await recordAction(
      {},
      formData({ lotId: "3", kind: "GIFT", grams: "100", note: "" }),
    );

    expect(recordGift).toHaveBeenCalledWith({}, 3, 100, null);
    expect(result.receipt).toEqual({ id: 5, lotId: 3, kind: "OUT", reason: "GIFT", grams: 100 });
  });

  it("ADJUST_OUT memetakan ke reason ADJUST dan kind OUT dari hasil service", async () => {
    vi.mocked(recordAdjust).mockResolvedValue({
      id: 9, lotId: 4, ts: new Date(), kind: "OUT", reason: "ADJUST", grams: 5, note: "koreksi timbangan",
    });

    const result = await recordAction(
      {},
      formData({ lotId: "4", kind: "ADJUST_OUT", grams: "5", note: "koreksi timbangan" }),
    );

    expect(recordAdjust).toHaveBeenCalledWith({}, 4, 5, "OUT", "koreksi timbangan");
    expect(result.receipt).toEqual({ id: 9, lotId: 4, kind: "OUT", reason: "ADJUST", grams: 5 });
  });

  it("kegagalan lalu retry yang sukses hanya membawa receipt pada percobaan yang berhasil", async () => {
    vi.mocked(recordBrew)
      .mockRejectedValueOnce(new InsufficientStockError("Stok tidak cukup."))
      .mockResolvedValueOnce({
        id: 11, lotId: 1, ts: new Date(), kind: "OUT", reason: "BREW", grams: 15, note: null,
      });

    const failed = await recordAction({}, formData({ lotId: "1", kind: "BREW", grams: "999", note: "" }));
    expect(failed.error).toBe("Stok tidak cukup.");
    expect(failed.receipt).toBeUndefined();

    const retried = await recordAction({}, formData({ lotId: "1", kind: "BREW", grams: "15", note: "" }));
    expect(retried.success).toBe(true);
    expect(retried.receipt).toEqual({ id: 11, lotId: 1, kind: "OUT", reason: "BREW", grams: 15 });
  });

  it("melempar ulang error yang bukan LedgerError, bukan mengembalikannya sebagai ActionState", async () => {
    vi.mocked(recordBrew).mockRejectedValue(new Error("boom, bukan LedgerError"));

    await expect(
      recordAction({}, formData({ lotId: "1", kind: "BREW", grams: "10", note: "" })),
    ).rejects.toThrow("boom, bukan LedgerError");
  });

  it("memanggil requireSession sebagai boundary auth", async () => {
    vi.mocked(recordBrew).mockResolvedValue({
      id: 1, lotId: 1, ts: new Date(), kind: "OUT", reason: "BREW", grams: 10, note: null,
    });

    await recordAction({}, formData({ lotId: "1", kind: "BREW", grams: "10", note: "" }));

    expect(requireSession).toHaveBeenCalled();
  });
});

describe("recordAction validasi input", () => {
  beforeEach(() => {
    vi.mocked(recordBrew).mockResolvedValue({
      id: 1, lotId: 1, ts: new Date(), kind: "OUT", reason: "BREW", grams: 10, note: null,
    });
  });

  it("menolak lotId yang tidak valid tanpa memanggil service", async () => {
    const result = await recordAction({}, formData({ lotId: "0", kind: "BREW", grams: "10", note: "" }));
    expect(result.error).toBe("Pilih lot dulu.");
    expect(recordBrew).not.toHaveBeenCalled();
  });

  it("menolak gram yang bukan angka tanpa memanggil service", async () => {
    const result = await recordAction({}, formData({ lotId: "1", kind: "BREW", grams: "abc", note: "" }));
    expect(result.error).toBe("Gram harus berupa angka.");
    expect(recordBrew).not.toHaveBeenCalled();
  });
});
