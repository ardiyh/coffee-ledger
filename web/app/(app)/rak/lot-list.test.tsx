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

afterEach(() => {
  cleanup();
  window.location.hash = "";
});
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

describe("LotList pencarian kosong dengan panel terbuka (UX-04)", () => {
  it("pesan hasil kosong mengakui panel yang tetap ditampilkan sebagai pengecualian", async () => {
    const user = userEvent.setup();
    render(<LotList lots={lots} suggestions={suggestions} />);

    // Open lot 1's transaction panel first -- `visible` in lot-list.tsx
    // deliberately keeps the open lot on screen regardless of the search
    // filter (protects its draft), so once the query below matches
    // nothing, lot 1 is still the one exception still visible.
    const [openLot1] = screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" });
    await user.click(openLot1);

    await user.type(screen.getByLabelText("Cari"), "zzz-tidak-ada-lot-begini");

    expect(screen.getByText("0 dari 3 lot")).toBeDefined();
    // The plain "nothing matches" message would contradict lot 1 still
    // being on screen -- it must acknowledge the exception instead.
    expect(screen.queryByText("Tidak ada lot yang cocok", { exact: true })).toBeNull();
    expect(screen.getByText(/Lot yang sedang dibuka tetap ditampilkan/)).toBeDefined();
    expect((document.getElementById("lot-form-1") as HTMLElement).hidden).toBe(false);

    // Closing the exempted panel drops it back out, since it still doesn't
    // match the filter -- the empty state should then read as a plain,
    // unqualified "nothing matches".
    await user.click(openLot1);
    expect((document.getElementById("lot-form-1") as HTMLElement).hidden).toBe(true);
    expect(screen.getByText("Tidak ada lot yang cocok", { exact: true })).toBeDefined();
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

  it("draft Edit lot pertama tetap utuh setelah kembali lewat tombol Catat, bukan tombol Edit", async () => {
    const user = userEvent.setup();
    render(<LotList lots={lots} suggestions={suggestions} />);

    // Capture every control up front, same reasoning as the tests above --
    // lot 1's own header (with its "Catat" button) hides while its Edit
    // panel is open.
    const [editLot1] = screen.getAllByRole("button", { name: "Edit" });
    const [catatLot1, catatLot2] = screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" });

    // UX-01 repro: open lot 1's Edit, type an unsaved draft.
    await user.click(editLot1);
    const nameInput1 = screen.getByLabelText("Nama") as HTMLInputElement;
    await user.clear(nameInput1);
    await user.type(nameInput1, "Draft belum disimpan");
    expect(nameInput1.value).toBe("Draft belum disimpan");

    // Open lot 2's transaction panel (not its Edit) -- closes lot 1.
    await user.click(catatLot2);
    const edit1 = document.getElementById("lot-edit-1") as HTMLElement;
    expect(edit1.hidden).toBe(true);

    // Come back to lot 1 via its *Catat* button (not Edit). This must show
    // lot 1's transaction panel, not its Edit panel -- and, critically,
    // must not have destroyed the Edit draft to get there.
    await user.click(catatLot1);
    const form1 = document.getElementById("lot-form-1") as HTMLElement;
    expect(form1.hidden).toBe(false);
    expect(edit1.hidden).toBe(true);
    expect(document.body.contains(nameInput1)).toBe(true);
    expect(nameInput1.value).toBe("Draft belum disimpan");

    // Opening Edit on lot 1 again must land on the exact same node with
    // the draft intact -- not a freshly mounted EditLotForm reset to the
    // saved name.
    await user.click(editLot1);
    expect(edit1.hidden).toBe(false);
    expect(within(edit1).getByLabelText("Nama")).toBe(nameInput1);
    expect(nameInput1.value).toBe("Draft belum disimpan");
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

describe("LotList navigasi lewat hash /rak#lot-<id>", () => {
  it("baris tiap lot punya target id dan tabIndex -1 untuk di-scroll/fokus", () => {
    render(<LotList lots={lots} suggestions={suggestions} />);
    const target1 = document.getElementById("lot-1") as HTMLElement;
    expect(target1).not.toBeNull();
    expect(target1.tabIndex).toBe(-1);
  });

  it("hash lot aktif membuka panelnya saat mount, dan memindahkan fokus ke situ", () => {
    window.location.hash = "#lot-1";
    render(<LotList lots={lots} suggestions={suggestions} />);

    const panel1 = document.getElementById("lot-form-1") as HTMLElement;
    expect(panel1.hidden).toBe(false);

    const target1 = document.getElementById("lot-1") as HTMLElement;
    expect(document.activeElement).toBe(target1);
  });

  it("hash lot yang stoknya habis melonggarkan status Aktif ke Semua supaya tetap terlihat", () => {
    window.location.hash = "#lot-3";
    render(<LotList lots={lots} suggestions={suggestions} />);

    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("all");
    const panel3 = document.getElementById("lot-form-3") as HTMLElement;
    expect(panel3.hidden).toBe(false);
    expect(screen.getByRole("button", { name: "Catat untuk Toraja Washed" })).toBeDefined();
  });

  it("ID lot yang tidak ada di daftar tidak mengubah apa pun", () => {
    window.location.hash = "#lot-999";
    render(<LotList lots={lots} suggestions={suggestions} />);

    // Status tetap default "Aktif", tidak ada panel yang kebuka.
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("active");
    expect((document.getElementById("lot-form-1") as HTMLElement).hidden).toBe(true);
    expect((document.getElementById("lot-form-2") as HTMLElement).hidden).toBe(true);
    expect(screen.getByText("2 dari 3 lot")).toBeDefined();
  });

  it("hash yang formatnya bukan #lot-<angka> diabaikan", () => {
    window.location.hash = "#bukan-lot";
    render(<LotList lots={lots} suggestions={suggestions} />);

    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("active");
    expect((document.getElementById("lot-form-1") as HTMLElement).hidden).toBe(true);
  });

  it("hashchange setelah mount membuka lot lain -- link kedua atau navigasi kembali", async () => {
    render(<LotList lots={lots} suggestions={suggestions} />);
    // Belum ada panel yang terbuka saat mount (tidak ada hash).
    expect((document.getElementById("lot-form-2") as HTMLElement).hidden).toBe(true);

    await act(async () => {
      window.location.hash = "#lot-2";
      window.dispatchEvent(new Event("hashchange"));
    });

    expect((document.getElementById("lot-form-2") as HTMLElement).hidden).toBe(false);
    expect(document.activeElement).toBe(document.getElementById("lot-2"));
  });

  it("refresh lots yang tidak terkait tidak membajak balik ke panel dari hash lama", async () => {
    // Reproduksi bug: buka lot 1 lewat hash, lalu user membuka lot 2 secara
    // manual, lalu satu refresh data server yang sama sekali tidak terkait
    // (array `lots` baru, isinya identik -- persis seperti yang terjadi
    // setelah recordAction/editLotAction di lot lain lewat revalidatePath).
    // Lot 2 harus tetap terbuka; hash lot 1 yang sudah "dipakai" tidak boleh
    // "diputar ulang" hanya karena `lots` berganti referensi.
    const user = userEvent.setup();
    window.location.hash = "#lot-1";
    const { rerender } = render(<LotList lots={lots} suggestions={suggestions} />);

    expect((document.getElementById("lot-form-1") as HTMLElement).hidden).toBe(false);

    const [, openLot2] = screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" });
    await user.click(openLot2);
    expect((document.getElementById("lot-form-2") as HTMLElement).hidden).toBe(false);
    expect((document.getElementById("lot-form-1") as HTMLElement).hidden).toBe(true);

    // Refresh yang tidak terkait: array baru, konten sama persis.
    const refreshedLots = lots.map((l) => ({ ...l }));
    rerender(<LotList lots={refreshedLots} suggestions={suggestions} />);

    expect((document.getElementById("lot-form-2") as HTMLElement).hidden).toBe(false);
    expect((document.getElementById("lot-form-1") as HTMLElement).hidden).toBe(true);
  });

  it("mengganti Status setelah hash selesai dipakai tidak merebut fokus balik ke baris hash", async () => {
    // Reproduksi bug minor: setelah hash membuka & fokus lot 1, mengganti
    // Status (aksi user yang sama sekali tidak terkait) tidak boleh
    // menyeret fokus balik ke baris lot 1.
    const user = userEvent.setup();
    window.location.hash = "#lot-1";
    render(<LotList lots={lots} suggestions={suggestions} />);

    const target1 = document.getElementById("lot-1") as HTMLElement;
    expect(document.activeElement).toBe(target1);

    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement;
    await user.selectOptions(statusSelect, "all");

    expect(document.activeElement).toBe(statusSelect);
  });

  it("navigasi hash berulang ke id yang sama tetap memindahkan fokus (UX-03)", async () => {
    // UX-03 repro: initial hash focuses lot 1; user manually opens lot 2 and
    // focuses Cari; a genuine *second* hashchange event landing on the same
    // #lot-1 (e.g. clicking the same dashboard link twice) must move focus
    // again, not be silently swallowed by the id-equality dedupe that
    // e42fe4e introduced to stop *unrelated* refreshes from re-stealing
    // focus.
    const user = userEvent.setup();
    window.location.hash = "#lot-1";
    render(<LotList lots={lots} suggestions={suggestions} />);

    const target1 = document.getElementById("lot-1") as HTMLElement;
    expect(document.activeElement).toBe(target1);

    const [, openLot2] = screen.getAllByRole("button", { name: "Catat untuk Gayo Natural" });
    await user.click(openLot2);
    const cariInput = screen.getByLabelText("Cari");
    await user.click(cariInput);
    expect(document.activeElement).toBe(cariInput);

    // The first hash was already consumed (history.replaceState strips it),
    // so re-navigating to the same target is a genuine hash transition, not
    // a no-op -- exactly the "same dashboard link clicked twice" case.
    await act(async () => {
      window.location.hash = "#lot-1";
      window.dispatchEvent(new Event("hashchange"));
    });

    expect((document.getElementById("lot-form-1") as HTMLElement).hidden).toBe(false);
    expect(document.activeElement).toBe(target1);
  });
});

describe("LotList tombol Catat: teks singkat, accessible name lengkap (UX-02)", () => {
  // UX-02 repro: a long lot name rendered as the button's own visible text
  // (no width cap, no wrap allowed on the control group) blew out the
  // document's scrollWidth past 320/390px viewports. The fix shortens the
  // visible label to "Catat" and moves the full name into `aria-label` --
  // jsdom can't measure real layout/overflow (see the audit notes), but it
  // CAN confirm the accessible-name contract every existing
  // `getByRole("button", { name: "Catat untuk <lot>" })` query across this
  // suite and forms.test.tsx depends on is preserved byte-for-byte.
  const longName = "El Salvador, Roasted by Ease Coffee (Chiba, Japan)";
  const longNameLots: LotListItem[] = [
    {
      lotId: 1, name: longName, origin: "El Salvador", varietal: "Bourbon",
      processMethod: "Washed", roastProfile: "Filter", roastDate: "2026-08-01",
      notes: null, stock: 100,
    },
  ];

  it("teks tombol yang tampak singkat, tetapi accessible name tetap 'Catat untuk <nama>'", () => {
    render(<LotList lots={longNameLots} suggestions={suggestions} />);

    // Existing-test-shape query: getByRole with `name` matches the
    // *accessible* name (aria-label wins over visible text), so this must
    // still resolve even though the button no longer visibly renders the
    // full lot name.
    const catatButton = screen.getByRole("button", { name: `Catat untuk ${longName}` });
    expect(catatButton.textContent).toBe("Catat");
    expect(catatButton.getAttribute("aria-label")).toBe(`Catat untuk ${longName}`);
  });

  it("grup kontrol (stok, Edit, Catat) boleh membungkus, bukan shrink-0 kaku", () => {
    const { container } = render(<LotList lots={longNameLots} suggestions={suggestions} />);
    const catatButton = screen.getByRole("button", { name: `Catat untuk ${longName}` });
    const controlGroup = catatButton.closest("div.flex") as HTMLElement;

    expect(controlGroup).not.toBeNull();
    expect(controlGroup.className).toContain("flex-wrap");
    expect(controlGroup.className).not.toContain("shrink-0");
    // Sanity: this is still the row's own stock/Edit/Catat cluster, not some
    // unrelated ancestor further up the tree.
    expect(within(controlGroup).getByText("Edit")).toBeDefined();
    void container;
  });
});
