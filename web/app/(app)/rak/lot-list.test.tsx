// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LotList, type LotListItem } from "./lot-list";
import { editLotAction, recordAction, type ActionState } from "../actions";

// Same network-boundary mock as forms.test.tsx -- component tests exercise
// the real forms, writes are covered elsewhere with Postgres.
vi.mock("../actions", () => ({
  addLotAction: vi.fn(), editLotAction: vi.fn(), recordAction: vi.fn(),
}));

const suggestions = { origins: [], varietals: [], processMethods: [] };

// Two lots share a name but not an id -- this is the case a naive
// name-keyed lookup (instead of lotId) would collapse.
const lots: LotListItem[] = [
  {
    lotId: 1, name: "Gayo Natural", origin: "Gayo, Aceh", varietal: "Typica",
    processMethod: "Natural", roastProfile: "Filter", roastDate: "2026-08-01",
    notes: null, stock: 100,
  },
  {
    lotId: 2, name: "Gayo Natural", origin: "Kerinci, Jambi", varietal: "Typica",
    processMethod: "Natural", roastProfile: "Filter", roastDate: "2026-06-01",
    notes: null, stock: 300,
  },
  {
    lotId: 3, name: "Toraja Washed", origin: "Toraja, Sulawesi", varietal: "Catimor",
    processMethod: "Washed", roastProfile: "Espresso", roastDate: "2026-09-01",
    notes: null, stock: 0,
  },
];

afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

function panelIds(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[id^='lot-form-']")).map((el) => el.id);
}

describe("LotList pencarian", () => {
  it("mencari nama tanpa membedakan kapital", async () => {
    const user = userEvent.setup();
    render(<LotList lots={lots} suggestions={suggestions} />);
    await user.type(screen.getByLabelText("Cari"), "GAYO");
    expect(screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Catat untuk Toraja Washed" })).toBeNull();
  });

  it("mencari origin tanpa membedakan kapital", async () => {
    const user = userEvent.setup();
    render(<LotList lots={lots} suggestions={suggestions} />);
    await user.type(screen.getByLabelText("Cari"), "aceh");
    expect(screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" })).toHaveLength(1);
  });

  it("hasil kosong menampilkan pesan dan tombol Hapus pencarian", async () => {
    const user = userEvent.setup();
    render(<LotList lots={lots} suggestions={suggestions} />);
    await user.type(screen.getByLabelText("Cari"), "tidak ada begini");
    expect(screen.getByText("Tidak ada lot yang cocok")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Hapus pencarian" }));
    expect(screen.queryByText("Tidak ada lot yang cocok")).toBeNull();
    expect((screen.getByLabelText("Cari") as HTMLInputElement).value).toBe("");
  });

  it("Hapus pencarian hanya membersihkan teks jika status saat ini saja sudah cukup", async () => {
    const user = userEvent.setup();
    render(<LotList lots={lots} suggestions={suggestions} />);
    await user.type(screen.getByLabelText("Cari"), "tidak ada begini");
    await user.click(screen.getByRole("button", { name: "Hapus pencarian" }));
    // Default status "Aktif" alone already matches lot 1 & 2 -- clearing
    // the query should be enough, status shouldn't silently change.
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("active");
  });

  it("Hapus pencarian juga melonggarkan status kalau query saja tidak cukup", async () => {
    const user = userEvent.setup();
    // All three lots have stock, so "Habis" alone (no query) already
    // matches nothing -- clearing the query can't be enough by itself.
    const allActiveLots = lots.map((l) => ({ ...l, stock: l.stock > 0 ? l.stock : 50 }));
    render(<LotList lots={allActiveLots} suggestions={suggestions} />);
    await user.selectOptions(screen.getByLabelText("Status"), "empty");
    await user.type(screen.getByLabelText("Cari"), "tidak ada begini");
    await user.click(screen.getByRole("button", { name: "Hapus pencarian" }));
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("all");
    expect(screen.queryByText("Tidak ada lot yang cocok")).toBeNull();
  });
});

describe("LotList status", () => {
  it("default Aktif menyembunyikan lot yang stoknya habis", () => {
    render(<LotList lots={lots} suggestions={suggestions} />);
    expect(screen.queryByRole("button", { name: "Catat untuk Toraja Washed" })).toBeNull();
    expect(screen.getByText("2 dari 3 lot")).toBeDefined();
  });

  it("Habis menampilkan hanya lot yang stoknya nol", async () => {
    const user = userEvent.setup();
    render(<LotList lots={lots} suggestions={suggestions} />);
    await user.selectOptions(screen.getByLabelText("Status"), "empty");
    expect(screen.getByRole("button", { name: "Catat untuk Toraja Washed" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Catat untuk Gayo Natural" })).toBeNull();
  });

  it("Semua menampilkan semua lot", async () => {
    const user = userEvent.setup();
    render(<LotList lots={lots} suggestions={suggestions} />);
    await user.selectOptions(screen.getByLabelText("Status"), "all");
    expect(screen.getByText("3 dari 3 lot")).toBeDefined();
  });
});

describe("LotList sort", () => {
  it("default urut Nama A-Z, tie-break lotId", () => {
    const { container } = render(<LotList lots={lots} suggestions={suggestions} />);
    expect(panelIds(container)).toEqual(["lot-form-1", "lot-form-2", "lot-form-3"]);
  });

  it("urut Stok menurun", async () => {
    const user = userEvent.setup();
    const { container } = render(<LotList lots={lots} suggestions={suggestions} />);
    await user.selectOptions(screen.getByLabelText("Urutkan"), "stock");
    expect(panelIds(container)).toEqual(["lot-form-2", "lot-form-1", "lot-form-3"]);
  });

  it("urut Hari sejak roast, terlama dulu", async () => {
    const user = userEvent.setup();
    const { container } = render(<LotList lots={lots} suggestions={suggestions} />);
    await user.selectOptions(screen.getByLabelText("Urutkan"), "age");
    expect(panelIds(container)).toEqual(["lot-form-2", "lot-form-1", "lot-form-3"]);
  });
});

describe("LotList panel tunggal dan draft", () => {
  it("hanya satu panel terbuka; draft lot pertama utuh setelah membuka lot kedua lalu kembali", async () => {
    const user = userEvent.setup();
    render(<LotList lots={lots} suggestions={suggestions} />);

    const [openLot1] = screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" });
    await user.click(openLot1);
    expect(openLot1.getAttribute("aria-expanded")).toBe("true");
    expect(openLot1.getAttribute("aria-controls")).toBe("lot-form-1");

    // Scope by the panel LotList never unmounts (id="lot-form-1") rather
    // than a plain label query -- getByLabelText doesn't filter by the
    // `hidden` attribute the way getByRole does, so every lot's "Gram"
    // field would otherwise match at once.
    const panel1 = document.getElementById("lot-form-1") as HTMLElement;
    const gramsInput = within(panel1).getByLabelText("Gram") as HTMLInputElement;
    await user.type(gramsInput, "18.2");
    await user.type(within(panel1).getByLabelText("Catatan (opsional)"), "draft pertama");
    expect(gramsInput.value).toBe("18.2");
    expect(panel1.hidden).toBe(false);

    // Open the second lot (same name, different id) -- lot 1's panel must
    // hide, not unmount: the same DOM node should still exist afterwards.
    const [, openLot2] = screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" });
    await user.click(openLot2);

    expect(openLot1.getAttribute("aria-expanded")).toBe("false");
    expect(openLot2.getAttribute("aria-expanded")).toBe("true");
    // lot 1's panel is hidden, not removed -- the very same input node is
    // still in the document with its typed value intact.
    expect(panel1.hidden).toBe(true);
    expect(document.body.contains(gramsInput)).toBe(true);
    expect(gramsInput.value).toBe("18.2");
    // lot 2's panel is a different node entirely.
    const panel2 = document.getElementById("lot-form-2") as HTMLElement;
    expect(panel2.hidden).toBe(false);
    expect(within(panel2).getByLabelText("Gram")).not.toBe(gramsInput);

    // Coming back to lot 1 shows the exact same node, draft intact.
    await user.click(openLot1);
    expect(panel1.hidden).toBe(false);
    expect(within(panel1).getByLabelText("Gram")).toBe(gramsInput);
    expect(gramsInput.value).toBe("18.2");
    expect((within(panel1).getByLabelText("Catatan (opsional)") as HTMLInputElement).value).toBe("draft pertama");
  });

  it("membuka Edit menutup panel transaksi lot yang sama", async () => {
    const user = userEvent.setup();
    render(<LotList lots={lots} suggestions={suggestions} />);
    const [openLot1] = screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" });
    await user.click(openLot1);
    const panel1 = document.getElementById("lot-form-1") as HTMLElement;
    expect(panel1.hidden).toBe(false);

    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);

    // Editing replaces the header (Edit/Catat buttons included) with
    // EditLotForm, same as the pre-existing pattern -- so the toggle
    // button for lot 1 disappears rather than flipping aria-expanded.
    expect(screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" })).toHaveLength(1);
    expect(screen.getByLabelText("Nama")).toBeDefined();
    expect(panel1.hidden).toBe(true);
  });
});

describe("LotList draft edit bertahan", () => {
  it("draft Edit lot pertama yang belum disimpan utuh setelah membuka Edit lot kedua lalu kembali", async () => {
    const user = userEvent.setup();
    render(<LotList lots={lots} suggestions={suggestions} />);

    // Capture both Edit buttons up front -- once lot 1's Edit opens, lot
    // 1's own header (Edit button included) hides along with it, so
    // re-querying by role afterwards would silently shift indices.
    const [editLot1, editLot2] = screen.getAllByRole("button", { name: "Edit" });

    // Reproduces the reviewer's repro: open lot 1's Edit, type an unsaved
    // change, switch to lot 2's Edit, come back to lot 1's Edit -- the
    // typed name must still be there, not reverted to "Gayo Natural".
    await user.click(editLot1);
    const nameInput1 = screen.getByLabelText("Nama") as HTMLInputElement;
    await user.clear(nameInput1);
    await user.type(nameInput1, "Draft belum disimpan");
    expect(nameInput1.value).toBe("Draft belum disimpan");

    // Switch to lot 2's Edit -- lot 1's Edit panel must hide, not unmount.
    await user.click(editLot2);

    const edit1 = document.getElementById("lot-edit-1") as HTMLElement;
    expect(edit1.hidden).toBe(true);
    expect(document.body.contains(nameInput1)).toBe(true);
    expect(nameInput1.value).toBe("Draft belum disimpan");

    const edit2 = document.getElementById("lot-edit-2") as HTMLElement;
    expect(edit2.hidden).toBe(false);
    expect(within(edit2).getByLabelText("Nama")).not.toBe(nameInput1);

    // Come back to lot 1's Edit: same node, draft intact.
    await user.click(editLot1);
    expect(edit1.hidden).toBe(false);
    expect(within(edit1).getByLabelText("Nama")).toBe(nameInput1);
    expect(nameInput1.value).toBe("Draft belum disimpan");
  });

  it("mencegah membuka lot lain selama penyimpanan edit berjalan, dan tidak macet setelahnya", async () => {
    const user = userEvent.setup();
    let finish!: (result: ActionState) => void;
    vi.mocked(editLotAction).mockImplementation(
      () => new Promise((resolve) => { finish = resolve; }),
    );
    render(<LotList lots={lots} suggestions={suggestions} />);

    // Capture every control up front, before lot 1's Edit hides its own
    // header and shifts the "Edit" role query down to a single match.
    const [editLot1, editLot2] = screen.getAllByRole("button", { name: "Edit" });
    const [, catatLot2] = screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" });

    await user.click(editLot1);
    const edit1 = document.getElementById("lot-edit-1") as HTMLElement;
    await user.click(within(edit1).getByRole("button", { name: "Simpan" }));

    // Edit save in flight for lot 1 -- lot 2's controls are locked, exactly
    // like the transaction-pending guard.
    expect((catatLot2 as HTMLButtonElement).disabled).toBe(true);
    expect((editLot2 as HTMLButtonElement).disabled).toBe(true);

    await act(async () => finish({ success: true }));

    // Once the save resolves, lot 2's controls unlock again -- the bubbled
    // editPending flag didn't get stuck at `true` (see the comment on
    // handleEditExit in lot-row.tsx for why that was a real risk).
    expect((catatLot2 as HTMLButtonElement).disabled).toBe(false);
    expect((editLot2 as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("LotList request pending", () => {
  it("mencegah penutupan panel dan membuka lot lain selama request berjalan", async () => {
    const user = userEvent.setup();
    let finish!: (result: ActionState) => void;
    vi.mocked(recordAction).mockImplementation(
      () => new Promise((resolve) => { finish = resolve; }),
    );
    render(<LotList lots={lots} suggestions={suggestions} />);

    const [openLot1] = screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" });
    await user.click(openLot1);
    const panel1 = document.getElementById("lot-form-1") as HTMLElement;
    await user.type(within(panel1).getByLabelText("Gram"), "10");
    await user.click(within(panel1).getByRole("button", { name: "Catat" }));

    expect((openLot1 as HTMLButtonElement).disabled).toBe(true);
    const [, openLot2] = screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" });
    expect((openLot2 as HTMLButtonElement).disabled).toBe(true);

    await act(async () => finish({ success: true }));

    expect((openLot1 as HTMLButtonElement).disabled).toBe(false);
    expect((openLot2 as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("LotList lot menjadi habis", () => {
  it("menahan lot yang sedang terbuka tetap terlihat dan menjelaskan stok habis", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LotList lots={lots} suggestions={suggestions} />);
    const [openLot1] = screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" });
    await user.click(openLot1);

    const updated = lots.map((l) => (l.lotId === 1 ? { ...l, stock: 0 } : l));
    rerender(<LotList lots={updated} suggestions={suggestions} />);

    // lot 1 stays visible (forced open) even though it now fails the
    // "Aktif" filter; lot 2 is still separately visible on its own merit
    // (stock 300, matches "Aktif") -- so both "Gayo Natural" rows show.
    expect(screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" })).toHaveLength(2);
    expect(screen.getByText(/Stok sudah habis/)).toBeDefined();
  });

  it("lot yang masih aktif tetap terbuka saat difilter keluar, tanpa pesan stok habis", async () => {
    const user = userEvent.setup();
    render(<LotList lots={lots} suggestions={suggestions} />);
    const [openLot1] = screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" });
    await user.click(openLot1);
    await user.selectOptions(screen.getByLabelText("Status"), "empty");

    // lot 1 (stock 100) still visible because it's the open lot, even
    // though the "Habis" filter alone wouldn't match it.
    expect(screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" })).toHaveLength(1);
    expect(screen.queryByText(/Stok sudah habis/)).toBeNull();
  });
});
