// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LotRow, type LotRowProps } from "./lot-row";
import { LotList, type LotListItem } from "./lot-list";
import { AddLotForm } from "./add-lot-form";
import {
  addLotAction,
  editLotAction,
  recordAction,
  type ActionState,
  type TransactionReceipt,
} from "../actions";

// These are network boundaries in the browser. Component tests exercise the
// actual forms; service/database writes are covered with Postgres in ledger.test.
vi.mock("../actions", () => ({
  addLotAction: vi.fn(), editLotAction: vi.fn(), recordAction: vi.fn(),
}));

type BaseProps = Omit<LotRowProps, "hidden" | "isOpen" | "otherPending" | "onOpenChange" | "onPendingChange">;

const props: BaseProps = {
  lotId: 1, name: "Gayo Natural", origin: "Gayo, Aceh", varietal: "Typica",
  processMethod: "Natural", roastProfile: "Filter", roastDate: "2026-09-01",
  notes: null, stock: 250,
  suggestions: { origins: [], varietals: [], processMethods: [] },
  onRecorded: () => {},
};

function receipt(overrides: Partial<TransactionReceipt> = {}): TransactionReceipt {
  return { id: 1, lotId: 1, kind: "OUT", reason: "BREW", grams: 18, ...overrides };
}

/**
 * Stands in for LotList's open/close plumbing: exactly one lot open at a
 * time, tracked by id, exactly like the real parent. LotRow itself no
 * longer owns "is my panel open" -- these tests drive that the same way a
 * user would, via the "Catat untuk ..."/Edit controls, not by reaching
 * into internals.
 */
function Harness(overrides: Partial<BaseProps> = {}) {
  const merged: BaseProps = { ...props, ...overrides };
  const [openLotId, setOpenLotId] = useState<number | null>(null);
  return (
    <LotRow
      {...merged}
      hidden={false}
      isOpen={openLotId === merged.lotId}
      otherPending={false}
      onOpenChange={(open) => setOpenLotId(open ? merged.lotId : null)}
      onPendingChange={() => {}}
    />
  );
}

afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

describe("Rak transactions", () => {
  it("memilih Seduh untuk stok aktif dan Masuk untuk stok kosong", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Catat untuk Gayo Natural" }));
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("BREW");
    rerender(<Harness stock={0} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("ACQUIRE");
  });

  it("mempertahankan isian saat ditolak, memicu onRecorded dan mereset isian setelah dicatat", async () => {
    const user = userEvent.setup();
    const onRecorded = vi.fn();
    vi.mocked(recordAction).mockResolvedValueOnce({ error: "Stok tidak cukup." })
      .mockResolvedValue({ success: true, receipt: receipt({ grams: 18.2 }) });
    render(<Harness onRecorded={onRecorded} />);
    await user.click(screen.getByRole("button", { name: "Catat untuk Gayo Natural" }));
    await user.type(screen.getByRole("spinbutton"), "18.2");
    await user.type(screen.getByPlaceholderText("Catatan tambahan..."), "sesi pagi");
    await user.click(screen.getByRole("button", { name: "Catat" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Stok tidak cukup.");
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("18.2");
    expect((screen.getByPlaceholderText("Catatan tambahan...") as HTMLInputElement).value).toBe("sesi pagi");
    expect(onRecorded).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Catat" }));
    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));
    expect(onRecorded).toHaveBeenCalledWith(receipt({ grams: 18.2 }));
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("");
    expect((screen.getByPlaceholderText("Catatan tambahan...") as HTMLInputElement).value).toBe("");

    // A second successful submission must reset too.
    await user.type(screen.getByRole("spinbutton"), "15");
    await user.click(screen.getByRole("button", { name: "Catat" }));
    await waitFor(() => expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe(""));
  });

  it("dua sukses berturut-turut memicu onRecorded dengan receipt ID yang berbeda", async () => {
    const user = userEvent.setup();
    const onRecorded = vi.fn();
    vi.mocked(recordAction)
      .mockResolvedValueOnce({ success: true, receipt: receipt({ id: 1, grams: 18 }) })
      .mockResolvedValueOnce({ success: true, receipt: receipt({ id: 2, grams: 20 }) });
    render(<Harness onRecorded={onRecorded} />);
    await user.click(screen.getByRole("button", { name: "Catat untuk Gayo Natural" }));

    await user.type(screen.getByRole("spinbutton"), "18");
    await user.click(screen.getByRole("button", { name: "Catat" }));
    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));

    await user.type(screen.getByRole("spinbutton"), "20");
    await user.click(screen.getByRole("button", { name: "Catat" }));
    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(2));

    const [[first], [second]] = onRecorded.mock.calls;
    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
    expect(first.id).not.toBe(second.id);
  });

  it("klik ganda saat pending tidak mengirim dua request", async () => {
    const user = userEvent.setup();
    let resolveRecord!: (result: ActionState) => void;
    vi.mocked(recordAction).mockImplementation(
      () => new Promise((resolve) => { resolveRecord = resolve; }),
    );
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Catat untuk Gayo Natural" }));
    await user.type(screen.getByRole("spinbutton"), "18");

    await user.click(screen.getByRole("button", { name: "Catat" }));
    expect(recordAction).toHaveBeenCalledTimes(1);
    // The button is disabled (and relabeled) the instant a submit is in
    // flight -- a second click on it is a no-op, not a second request.
    await user.click(screen.getByRole("button", { name: "Menyimpan..." }));
    expect(recordAction).toHaveBeenCalledTimes(1);

    await act(async () => resolveRecord({ success: true, receipt: receipt() }));
  });

  it("field catatan berlabel Penerima untuk GIFT, Catatan untuk aksi lain", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Catat untuk Gayo Natural" }));
    expect(screen.getByText("Catatan (opsional)")).toBeDefined();
    expect(screen.queryByText("Penerima (opsional)")).toBeNull();

    await user.selectOptions(screen.getByRole("combobox"), "GIFT");
    expect(screen.getByText("Penerima (opsional)")).toBeDefined();
    expect(
      screen.getByText("Isi nama penerima saja; dipakai untuk ringkasan hadiah."),
    ).toBeDefined();
    expect(screen.queryByText("Catatan (opsional)")).toBeNull();
    const noteInput = screen.getByPlaceholderText("Nama penerima...") as HTMLInputElement;
    expect(noteInput.getAttribute("name")).toBe("note");

    await user.selectOptions(screen.getByRole("combobox"), "BREW");
    expect(screen.getByText("Catatan (opsional)")).toBeDefined();
    expect(screen.queryByText("Penerima (opsional)")).toBeNull();
  });

  it("GIFT tanpa penerima tetap terkirim dengan note kosong", async () => {
    const user = userEvent.setup();
    const onRecorded = vi.fn();
    vi.mocked(recordAction).mockResolvedValue({
      success: true,
      receipt: receipt({ id: 9, reason: "GIFT", grams: 50 }),
    });
    render(<Harness onRecorded={onRecorded} />);
    await user.click(screen.getByRole("button", { name: "Catat untuk Gayo Natural" }));
    await user.selectOptions(screen.getByRole("combobox"), "GIFT");
    await user.type(screen.getByRole("spinbutton"), "50");
    await user.click(screen.getByRole("button", { name: "Catat" }));

    await waitFor(() => expect(onRecorded).toHaveBeenCalledWith(receipt({ id: 9, reason: "GIFT", grams: 50 })));
    const submitted = vi.mocked(recordAction).mock.calls[0][1];
    expect(submitted.get("kind")).toBe("GIFT");
    expect(submitted.get("note")).toBe("");
  });

  it("menampilkan 'Memperbarui stok…' setelah sukses sampai prop stock ter-refresh", async () => {
    const user = userEvent.setup();
    vi.mocked(recordAction).mockResolvedValue({
      success: true,
      receipt: receipt({ grams: 18 }),
    });
    const { rerender } = render(<Harness />);
    expect(screen.getByText("250 g")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Catat untuk Gayo Natural" }));
    await user.type(screen.getByRole("spinbutton"), "18");
    await user.click(screen.getByRole("button", { name: "Catat" }));

    await waitFor(() => expect(screen.getByText("Memperbarui stok…")).toBeDefined());
    // No client-side subtraction -- the placeholder shows, not a guessed number.
    expect(screen.queryByText("232 g")).toBeNull();
    expect(screen.queryByText("250 g")).toBeNull();

    // The parent re-renders with the server-refreshed stock once revalidation lands.
    rerender(<Harness stock={232} />);
    expect(screen.queryByText("Memperbarui stok…")).toBeNull();
    expect(screen.getByText("232 g")).toBeDefined();
  });

  it("Batal membuang perubahan edit tanpa mencatat transaksi", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Nama"));
    await user.type(screen.getByLabelText("Nama"), "Perubahan sementara");
    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(screen.getByText("Gayo Natural")).toBeDefined();
    expect(editLotAction).not.toHaveBeenCalled();
    expect(recordAction).not.toHaveBeenCalled();
  });

  it("tidak menawarkan Batal saat penyimpanan edit sedang berjalan", async () => {
    const user = userEvent.setup();
    let finish!: (result: ActionState) => void;
    vi.mocked(editLotAction).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Simpan" }));
    const cancelDisabled = (screen.getByRole("button", { name: "Batal" }) as HTMLButtonElement).disabled;
    await act(async () => finish({ success: true }));
    expect(cancelDisabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Simpan" })).toBeNull();
  });

  it("form edit lot terisi dari roastProfile awal dan mengirim perubahannya", async () => {
    const user = userEvent.setup();
    vi.mocked(editLotAction).mockResolvedValue({ success: true });
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect((screen.getByLabelText("Profil roast") as HTMLSelectElement).value).toBe("Filter");
    await user.selectOptions(screen.getByLabelText("Profil roast"), "Omniroast");
    await user.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(editLotAction).toHaveBeenCalled());
    const submitted = vi.mocked(editLotAction).mock.calls[0][1];
    expect(submitted.get("roastProfile")).toBe("Omniroast");
  });

  it("panel Catat/Edit membawa aria-expanded dan aria-controls yang benar", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: "Catat untuk Gayo Natural" });
    expect(toggle.getAttribute("aria-controls")).toBe("lot-form-1");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("LotList receipt banner", () => {
  const oneLot: LotListItem[] = [{
    lotId: 1, name: "Gayo Natural", origin: "Gayo, Aceh", varietal: "Typica",
    processMethod: "Natural", roastProfile: "Filter", roastDate: "2026-09-01",
    notes: null, stock: 250,
  }];

  it("belum ada banner sebelum transaksi apa pun tercatat", () => {
    render(<LotList lots={oneLot} suggestions={props.suggestions} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("banner menyebut aksi, gram, dan nama lot, serta tautan ke histori lot itu", async () => {
    const user = userEvent.setup();
    vi.mocked(recordAction).mockResolvedValue({
      success: true,
      receipt: receipt({ id: 1, lotId: 1, kind: "OUT", reason: "BREW", grams: 18 }),
    });
    render(<LotList lots={oneLot} suggestions={props.suggestions} />);
    await user.click(screen.getByRole("button", { name: "Catat untuk Gayo Natural" }));
    await user.type(screen.getByRole("spinbutton"), "18");
    await user.click(screen.getByRole("button", { name: "Catat" }));

    const banner = await screen.findByRole("status");
    expect(banner.textContent).toContain("Seduh 18 g · Gayo Natural tercatat.");
    const link = banner.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/history?lot=1");
  });

  it("banner tetap terlihat walau stok berubah menjadi nol dan panel ditutup", async () => {
    const user = userEvent.setup();
    vi.mocked(recordAction).mockResolvedValue({
      success: true,
      receipt: receipt({ id: 2, lotId: 1, kind: "OUT", reason: "BREW", grams: 250 }),
    });
    const { rerender } = render(<LotList lots={oneLot} suggestions={props.suggestions} />);
    await user.click(screen.getByRole("button", { name: "Catat untuk Gayo Natural" }));
    await user.type(screen.getByRole("spinbutton"), "250");
    await user.click(screen.getByRole("button", { name: "Catat" }));
    await screen.findByRole("status");

    // The server-refreshed lots prop now reports the lot as empty.
    rerender(<LotList lots={[{ ...oneLot[0], stock: 0 }]} suggestions={props.suggestions} />);
    expect(screen.getByRole("status").textContent).toContain("Seduh 250 g · Gayo Natural tercatat.");

    // Closing the now-empty lot's panel must not take the banner with it.
    await user.click(screen.getByRole("button", { name: "Catat untuk Gayo Natural" }));
    expect(screen.getByRole("status").textContent).toContain("Seduh 250 g · Gayo Natural tercatat.");
  });

  it("dua transaksi berturut-turut menggantikan banner, bukan menumpuknya", async () => {
    const user = userEvent.setup();
    vi.mocked(recordAction)
      .mockResolvedValueOnce({
        success: true,
        receipt: receipt({ id: 1, lotId: 1, kind: "OUT", reason: "BREW", grams: 18 }),
      })
      .mockResolvedValueOnce({
        success: true,
        receipt: receipt({ id: 2, lotId: 1, kind: "IN", reason: "ACQUIRE", grams: 500 }),
      });
    render(<LotList lots={oneLot} suggestions={props.suggestions} />);
    await user.click(screen.getByRole("button", { name: "Catat untuk Gayo Natural" }));
    await user.type(screen.getByRole("spinbutton"), "18");
    await user.click(screen.getByRole("button", { name: "Catat" }));
    await screen.findByRole("status");

    await user.selectOptions(screen.getByLabelText("Aksi"), "ACQUIRE");
    await user.type(screen.getByRole("spinbutton"), "500");
    await user.click(screen.getByRole("button", { name: "Catat" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("Masuk / beli 500 g · Gayo Natural tercatat.");
    });
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});

it("form tambah lot mempertahankan data saat gagal lalu reset setelah berhasil", async () => {
  const user = userEvent.setup();
  vi.mocked(addLotAction).mockResolvedValueOnce({ error: "Gram harus lebih dari nol." })
    .mockResolvedValueOnce({ success: true });
  render(<AddLotForm todayISO="2026-09-01" suggestions={props.suggestions} />);
  await user.type(screen.getByLabelText("Origin"), "Gayo, Aceh");
  await user.type(screen.getByLabelText("Varietal"), "Typica");
  await user.type(screen.getByLabelText("Proses pasca panen"), "Natural");
  await user.selectOptions(screen.getByLabelText("Profil roast"), "Espresso");
  await user.type(screen.getByLabelText("Stok awal, gram (opsional)"), "0");
  await user.click(screen.getByRole("button", { name: "Tambah lot" }));
  await screen.findByRole("alert");
  expect((screen.getByLabelText("Origin") as HTMLInputElement).value).toBe("Gayo, Aceh");
  await user.clear(screen.getByLabelText("Stok awal, gram (opsional)"));
  await user.type(screen.getByLabelText("Stok awal, gram (opsional)"), "250");
  await user.click(screen.getByRole("button", { name: "Tambah lot" }));
  expect((await screen.findByRole("status")).textContent).toBe("Lot ditambahkan.");
  expect((screen.getByLabelText("Origin") as HTMLInputElement).value).toBe("");
});

it("form tambah lot mengirim roastProfile yang dipilih", async () => {
  const user = userEvent.setup();
  vi.mocked(addLotAction).mockResolvedValue({ success: true });
  render(<AddLotForm todayISO="2026-09-01" suggestions={props.suggestions} />);
  await user.type(screen.getByLabelText("Origin"), "Gayo, Aceh");
  await user.type(screen.getByLabelText("Varietal"), "Typica");
  await user.type(screen.getByLabelText("Proses pasca panen"), "Natural");
  await user.selectOptions(screen.getByLabelText("Profil roast"), "Omniroast");
  await user.click(screen.getByRole("button", { name: "Tambah lot" }));
  await screen.findByRole("status");
  const submitted = vi.mocked(addLotAction).mock.calls[0][1];
  expect(submitted.get("roastProfile")).toBe("Omniroast");
});
