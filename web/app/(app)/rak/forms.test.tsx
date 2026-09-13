// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LotRow, type LotRowProps } from "./lot-row";
import { AddLotForm } from "./add-lot-form";
import { addLotAction, editLotAction, recordAction, type ActionState } from "../actions";

// These are network boundaries in the browser. Component tests exercise the
// actual forms; service/database writes are covered with Postgres in ledger.test.
vi.mock("../actions", () => ({
  addLotAction: vi.fn(), editLotAction: vi.fn(), recordAction: vi.fn(),
}));

const props: LotRowProps = {
  lotId: 1, name: "Gayo Natural", origin: "Gayo, Aceh", varietal: "Typica",
  processMethod: "Natural", roastDate: "2026-09-01", notes: null, stock: 250,
  suggestions: { origins: [], varietals: [], processMethods: [] },
};

afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

describe("Rak transactions", () => {
  it("memilih Seduh untuk stok aktif dan Masuk untuk stok kosong", () => {
    const { rerender } = render(<LotRow {...props} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("BREW");
    rerender(<LotRow {...props} stock={0} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("ACQUIRE");
  });

  it("mempertahankan isian saat ditolak dan mengumumkan keberhasilan setelah dicatat", async () => {
    const user = userEvent.setup();
    vi.mocked(recordAction).mockResolvedValueOnce({ error: "Stok tidak cukup." })
      .mockResolvedValue({ success: true });
    render(<LotRow {...props} />);
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
    render(<LotRow {...props} />);
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
    render(<LotRow {...props} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Simpan" }));
    const cancelDisabled = (screen.getByRole("button", { name: "Batal" }) as HTMLButtonElement).disabled;
    await act(async () => finish({ success: true }));
    expect(cancelDisabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Simpan" })).toBeNull();
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
