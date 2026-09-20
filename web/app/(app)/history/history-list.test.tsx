// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { HistoryList, type HistoryLotOption, type HistoryTxnItem } from "./history-list";

// Two lots share a name but not an id -- same case Task 2's lot-list
// fixtures establish; filtering here must go by lotId, not the name string.
const lots: HistoryLotOption[] = [
  { id: 1, name: "Gayo Natural" },
  { id: 2, name: "Gayo Natural" },
  { id: 3, name: "Toraja Washed" },
];

const txns: HistoryTxnItem[] = [
  {
    id: 1, lotId: 1, ts: "2026-09-01T00:00:00.000Z", kind: "IN",
    reason: "ACQUIRE", grams: 1000, note: null,
  },
  {
    id: 2, lotId: 2, ts: "2026-09-02T00:00:00.000Z", kind: "IN",
    reason: "ACQUIRE", grams: 500, note: "lot kedua",
  },
  // Boundary example from the plan: 17:00:00Z is already 19 Sept in WIB
  // (UTC+7, no DST) even though the UTC calendar date is still the 18th.
  {
    id: 3, lotId: 1, ts: "2026-09-18T17:00:00.000Z", kind: "OUT",
    reason: "BREW", grams: 18, note: "pas tengah malam WIB 19",
  },
  // One millisecond earlier -- still 18 Sept in WIB, must NOT match a
  // "19 Sept" date filter.
  {
    id: 4, lotId: 3, ts: "2026-09-18T16:59:59.999Z", kind: "OUT",
    reason: "BREW", grams: 18, note: "sepersekian detik sebelumnya",
  },
  // Identical timestamps, different ids -- sort must tie-break by id desc.
  {
    id: 5, lotId: 1, ts: "2026-09-10T05:00:00.000Z", kind: "OUT",
    reason: "GIFT", grams: 200, note: "kasih teman",
  },
  {
    id: 6, lotId: 2, ts: "2026-09-10T05:00:00.000Z", kind: "IN",
    reason: "ADJUST", grams: 5, note: "koreksi",
  },
  {
    id: 7, lotId: 3, ts: "2026-09-05T00:00:00.000Z", kind: "OUT",
    reason: "ADJUST", grams: 3, note: null,
  },
];

afterEach(cleanup);

function desktopRowTexts(container: HTMLElement): string[] {
  const table = container.querySelector("table") as HTMLTableElement;
  return Array.from(table.querySelectorAll("tbody tr")).map((tr) => tr.textContent ?? "");
}

function mobileCardTexts(container: HTMLElement): string[] {
  const ul = container.querySelector("ul") as HTMLUListElement;
  return Array.from(ul.querySelectorAll("li")).map((li) => li.textContent ?? "");
}

function countLabel() {
  return screen.getByText(/^Menampilkan \d+ dari \d+ transaksi$/).textContent;
}

describe("HistoryList filter lot (berdasarkan ID)", () => {
  it("memilih salah satu dari dua lot bernama sama menampilkan hanya transaksi lot itu", async () => {
    const user = userEvent.setup();
    const { container } = render(<HistoryList transactions={txns} lots={lots} initialLotId={null} />);
    await user.selectOptions(screen.getByLabelText("Lot"), "2");

    expect(desktopRowTexts(container)).toHaveLength(2);
    expect(mobileCardTexts(container)).toHaveLength(2);
    expect(screen.getAllByText(/lot kedua/)).toHaveLength(2); // mobile + desktop
    expect(screen.getAllByText(/koreksi/)).toHaveLength(2);
    expect(screen.queryByText(/kasih teman/)).toBeNull();
    expect(countLabel()).toBe("Menampilkan 2 dari 7 transaksi");
  });

  it("initialLotId dari prop mengisi filter lot awal", () => {
    const { container } = render(<HistoryList transactions={txns} lots={lots} initialLotId={1} />);
    expect((screen.getByLabelText("Lot") as HTMLSelectElement).value).toBe("1");
    expect(desktopRowTexts(container)).toHaveLength(3); // ids 1, 3, 5
  });
});

describe("HistoryList sinkronisasi initialLotId saat navigasi", () => {
  it("berpindah dari satu tautan receipt ke lot lain memperbarui filter tanpa remount", () => {
    const { rerender, container } = render(
      <HistoryList transactions={txns} lots={lots} initialLotId={1} />,
    );
    expect((screen.getByLabelText("Lot") as HTMLSelectElement).value).toBe("1");
    expect(desktopRowTexts(container)).toHaveLength(3);

    rerender(<HistoryList transactions={txns} lots={lots} initialLotId={2} />);
    expect((screen.getByLabelText("Lot") as HTMLSelectElement).value).toBe("2");
    expect(desktopRowTexts(container)).toHaveLength(2);
  });

  it("re-render dengan initialLotId yang sama tidak menimpa perubahan filter manual", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HistoryList transactions={txns} lots={lots} initialLotId={1} />);
    await user.selectOptions(screen.getByLabelText("Lot"), "");
    expect((screen.getByLabelText("Lot") as HTMLSelectElement).value).toBe("");

    // Same initialLotId value again (e.g. a re-render not caused by a new
    // ?lot= navigation) -- the effect shouldn't fire and stomp the user's
    // manual choice back to lot 1.
    rerender(<HistoryList transactions={txns} lots={lots} initialLotId={1} />);
    expect((screen.getByLabelText("Lot") as HTMLSelectElement).value).toBe("");
  });
});

describe("HistoryList filter alasan", () => {
  it("memfilter berdasarkan alasan", async () => {
    const user = userEvent.setup();
    render(<HistoryList transactions={txns} lots={lots} initialLotId={null} />);
    await user.selectOptions(screen.getByLabelText("Alasan"), "BREW");
    expect(countLabel()).toBe("Menampilkan 2 dari 7 transaksi");
    expect(screen.getAllByText(/pas tengah malam WIB 19/)).toHaveLength(2);
    expect(screen.getAllByText(/sepersekian detik sebelumnya/)).toHaveLength(2);
    expect(screen.queryByText(/kasih teman/)).toBeNull();
  });
});

describe("HistoryList filter rentang tanggal WIB", () => {
  it("batas tengah malam WIB: 17:00:00Z termasuk 19 Sept, semilidetik sebelumnya tidak", async () => {
    const user = userEvent.setup();
    render(<HistoryList transactions={txns} lots={lots} initialLotId={null} />);
    await user.type(screen.getByLabelText("Dari tanggal"), "2026-09-19");
    await user.type(screen.getByLabelText("Sampai tanggal"), "2026-09-19");

    expect(countLabel()).toBe("Menampilkan 1 dari 7 transaksi");
    expect(screen.getAllByText(/pas tengah malam WIB 19/)).toHaveLength(2);
    expect(screen.queryByText(/sepersekian detik sebelumnya/)).toBeNull();
  });

  it("rentang inklusif di kedua ujung", async () => {
    const user = userEvent.setup();
    render(<HistoryList transactions={txns} lots={lots} initialLotId={null} />);
    await user.type(screen.getByLabelText("Dari tanggal"), "2026-09-01");
    await user.type(screen.getByLabelText("Sampai tanggal"), "2026-09-02");
    expect(countLabel()).toBe("Menampilkan 2 dari 7 transaksi");
  });

  it("tanggal awal setelah akhir menampilkan pesan dan tidak membalik ataupun menerapkan filter", async () => {
    const user = userEvent.setup();
    render(<HistoryList transactions={txns} lots={lots} initialLotId={null} />);
    await user.type(screen.getByLabelText("Dari tanggal"), "2026-09-15");
    await user.type(screen.getByLabelText("Sampai tanggal"), "2026-09-01");

    expect(screen.getByRole("alert")).toBeDefined();
    // Not silently swapped -- date filtering just doesn't apply, so every
    // transaction is still shown.
    expect(countLabel()).toBe("Menampilkan 7 dari 7 transaksi");
  });
});

describe("HistoryList reset filter", () => {
  it("mengembalikan semua filter ke default, termasuk lot dari initialLotId", async () => {
    const user = userEvent.setup();
    render(<HistoryList transactions={txns} lots={lots} initialLotId={1} />);
    await user.selectOptions(screen.getByLabelText("Alasan"), "BREW");
    await user.type(screen.getByLabelText("Dari tanggal"), "2026-09-01");
    await user.click(screen.getByRole("button", { name: "Reset filter" }));

    expect((screen.getByLabelText("Lot") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Alasan") as HTMLSelectElement).value).toBe("all");
    expect((screen.getByLabelText("Dari tanggal") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Sampai tanggal") as HTMLInputElement).value).toBe("");
    expect(countLabel()).toBe("Menampilkan 7 dari 7 transaksi");
  });
});

describe("HistoryList hasil kosong", () => {
  it("menampilkan empty state khusus filter, bukan pesan 'Belum ada transaksi'", async () => {
    const user = userEvent.setup();
    render(<HistoryList transactions={txns} lots={lots} initialLotId={null} />);
    await user.selectOptions(screen.getByLabelText("Lot"), "3");
    await user.selectOptions(screen.getByLabelText("Alasan"), "ACQUIRE");

    expect(countLabel()).toBe("Menampilkan 0 dari 7 transaksi");
    expect(screen.queryByText("Belum ada transaksi.")).toBeNull();
    expect(screen.getByText(/Tidak ada transaksi yang cocok/)).toBeDefined();
  });
});

describe("HistoryList urutan: terbaru dulu, tie-break ID menurun", () => {
  it("dua transaksi timestamp sama diurutkan ID menurun", () => {
    const { container } = render(<HistoryList transactions={txns} lots={lots} initialLotId={null} />);
    const rows = desktopRowTexts(container);
    const idxKoreksi = rows.findIndex((r) => r.includes("koreksi"));
    const idxKasihTeman = rows.findIndex((r) => r.includes("kasih teman"));
    expect(idxKoreksi).toBeGreaterThanOrEqual(0);
    expect(idxKasihTeman).toBeGreaterThanOrEqual(0);
    // id 6 (koreksi) before id 5 (kasih teman) despite identical ts.
    expect(idxKoreksi).toBeLessThan(idxKasihTeman);
  });

  it("urutan keseluruhan terbaru dulu", () => {
    const { container } = render(<HistoryList transactions={txns} lots={lots} initialLotId={null} />);
    const rows = desktopRowTexts(container);
    const noteOrder = rows.map((r): number | null => {
      if (r.includes("pas tengah malam")) return 3;
      if (r.includes("sepersekian detik")) return 4;
      if (r.includes("koreksi")) return 6;
      if (r.includes("kasih teman")) return 5;
      if (r.includes("lot kedua")) return 2;
      return null;
    }).filter((v): v is number => v !== null);
    expect(noteOrder).toEqual([3, 4, 6, 5, 2]);
  });
});

describe("HistoryList konsistensi mobile/desktop", () => {
  it("jumlah, tanda +/-, nama, alasan, catatan, dan timestamp sama di mobile dan desktop", async () => {
    const user = userEvent.setup();
    const { container } = render(<HistoryList transactions={txns} lots={lots} initialLotId={null} />);
    await user.selectOptions(screen.getByLabelText("Alasan"), "BREW");

    const desktop = desktopRowTexts(container);
    const mobile = mobileCardTexts(container);
    expect(desktop).toHaveLength(2);
    expect(mobile).toHaveLength(2);

    // Row 0: id 3, OUT, Toraja lot? No -- lotId 1, "Gayo Natural" is the
    // name but ambiguous across ids -- assert on grams sign + note instead.
    expect(desktop[0]).toContain("−");
    expect(desktop[0]).toContain("18 g");
    expect(desktop[0]).toContain("Seduh");
    expect(desktop[0]).toContain("pas tengah malam WIB 19");
    expect(mobile[0]).toContain("−");
    expect(mobile[0]).toContain("18 g");
    expect(mobile[0]).toContain("Seduh");
    expect(mobile[0]).toContain("pas tengah malam WIB 19");
  });
});

describe("HistoryList wrap teks lokal dipertahankan", () => {
  it("span nama lot dan catatan mobile tetap punya kelas overflow-wrap:anywhere", () => {
    const { container } = render(<HistoryList transactions={txns} lots={lots} initialLotId={null} />);
    const ul = container.querySelector("ul") as HTMLUListElement;
    const wrapped = ul.querySelectorAll(".\\[overflow-wrap\\:anywhere\\]");
    // At least the lot-name span and, for rows with notes, the note paragraph.
    expect(wrapped.length).toBeGreaterThan(0);
  });
});

describe("HistoryList filter Lot: lebar dibatasi, opsi tidak dipotong (UX-02)", () => {
  // UX-02 repro: the Lot <select>'s rendered width follows its widest
  // <option> text with no cap on the select or its wrapping <label>, so one
  // long lot name could blow out the whole filter row past 320/390px
  // viewports. jsdom doesn't compute real layout (can't assert the
  // overflow itself is gone -- see the audit notes and the real-browser
  // Playwright check done alongside this), but it CAN confirm the fix's
  // actual mechanism: a max-width + min-w-0 on the label, and that no
  // option text was truncated/lost from the DOM in the process (the
  // closed box's width is constrained by CSS, not the option content).
  const longName = "El Salvador, Roasted by Ease Coffee (Chiba, Japan)";
  const longNameLots: HistoryLotOption[] = [
    { id: 1, name: longName },
    { id: 2, name: "Toraja Washed" },
  ];

  it("label Lot punya min-w-0 dan max-w, tanpa memotong teks opsi di DOM", () => {
    const { container } = render(
      <HistoryList transactions={txns} lots={longNameLots} initialLotId={null} />,
    );

    const select = screen.getByLabelText("Lot") as HTMLSelectElement;
    const label = select.closest("label") as HTMLLabelElement;

    expect(label.className).toContain("min-w-0");
    expect(label.className).toMatch(/max-w-/);

    const optionTexts = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(optionTexts).toContain(longName);
    void container;
  });

  it("memilih lot bernama panjang lewat dropdown tetap berfungsi", async () => {
    const user = userEvent.setup();
    render(<HistoryList transactions={txns} lots={longNameLots} initialLotId={null} />);

    const select = screen.getByLabelText("Lot") as HTMLSelectElement;
    await user.selectOptions(select, longName);

    expect(select.value).toBe("1");
  });
});

