// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LotRow, type LotRowProps } from "./lot-row";
import { AddLotForm } from "./add-lot-form";
import { addLotAction, editLotAction, recordAction, type ActionState } from "../actions";

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
};

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

  it("mempertahankan isian saat ditolak dan mengumumkan keberhasilan setelah dicatat", async () => {
    const user = userEvent.setup();
    vi.mocked(recordAction).mockResolvedValueOnce({ error: "Stok tidak cukup." })
      .mockResolvedValue({ success: true });
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Catat untuk Gayo Natural" }));
    await user.type(screen.getByRole("spinbutton"), "18.2");
    await user.click(screen.getByRole("button", { name: "Catat" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Stok tidak cukup.");
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("18.2");
    await user.click(screen.getByRole("button", { name: "Catat" }));
    expect((await screen.findByRole("status")).textContent).toBe("Tercatat.");
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("");
    // A second successful submission must reset too.
    await user.type(screen.getByRole("spinbutton"), "15");
    await user.click(screen.getByRole("button", { name: "Catat" }));
    await waitFor(() => expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe(""));
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
