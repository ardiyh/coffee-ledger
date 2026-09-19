// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { StockBars } from "./stock-bars";

const rows = [
  { id: 1, name: "Lot Charlie", stock: 100, roastDate: "2022-01-01", processMethod: "Natural", roastProfile: "Filter" },
  { id: 2, name: "Lot Alpha", stock: 300, roastDate: "2021-01-01", processMethod: "Washed", roastProfile: "Espresso" },
  { id: 3, name: "Lot Beta", stock: 200, roastDate: "2020-01-01", processMethod: "Natural", roastProfile: "Omniroast" },
];

const rowsWithNulls = [
  ...rows,
  { id: 4, name: "Lot Delta", stock: 50, roastDate: "2019-01-01", processMethod: null, roastProfile: null },
];

afterEach(cleanup);

function renderedNames() {
  return screen
    .getAllByText(/^Lot (Alpha|Beta|Charlie|Delta)$/)
    .map((el) => el.textContent);
}

describe("StockBars sort", () => {
  it("default-nya urut stok menurun", () => {
    render(<StockBars rows={rows} />);
    expect(renderedNames()).toEqual(["Lot Alpha", "Lot Beta", "Lot Charlie"]);
  });

  it("urut nama, naik lalu turun", async () => {
    const user = userEvent.setup();
    render(<StockBars rows={rows} />);
    await user.selectOptions(screen.getByLabelText("Urutkan"), "name");
    // Default arah tetap "desc" -- Z ke A dulu.
    expect(renderedNames()).toEqual(["Lot Charlie", "Lot Beta", "Lot Alpha"]);
    await user.click(screen.getByRole("button", { name: /Urut (naik|turun)/ }));
    expect(renderedNames()).toEqual(["Lot Alpha", "Lot Beta", "Lot Charlie"]);
  });

  it("urut hari sejak roast, turun lalu naik", async () => {
    const user = userEvent.setup();
    render(<StockBars rows={rows} />);
    await user.selectOptions(screen.getByLabelText("Urutkan"), "daysSinceRoast");
    // Default arah tetap "desc" -- hari sejak roast terbesar (roastDate paling
    // lama, 2020) duluan.
    expect(renderedNames()).toEqual(["Lot Beta", "Lot Alpha", "Lot Charlie"]);
    await user.click(screen.getByRole("button", { name: /Urut (naik|turun)/ }));
    // "asc" -- hari sejak roast terkecil (roastDate paling baru, 2022) duluan.
    expect(renderedNames()).toEqual(["Lot Charlie", "Lot Alpha", "Lot Beta"]);
  });
});

describe("StockBars filter", () => {
  it("filter proses menyembunyikan lot lain dan lot tanpa proses", async () => {
    const user = userEvent.setup();
    render(<StockBars rows={rowsWithNulls} />);
    await user.click(screen.getByRole("button", { name: "Washed" }));
    expect(renderedNames()).toEqual(["Lot Alpha"]);
  });

  it("filter profil roast menyembunyikan lot lain dan lot tanpa profil", async () => {
    const user = userEvent.setup();
    render(<StockBars rows={rowsWithNulls} />);
    await user.click(screen.getByRole("button", { name: "Omniroast" }));
    expect(renderedNames()).toEqual(["Lot Beta"]);
  });

  it("filter proses dan profil roast digabung AND", async () => {
    const user = userEvent.setup();
    render(<StockBars rows={rowsWithNulls} />);
    await user.click(screen.getByRole("button", { name: "Natural" }));
    await user.click(screen.getByRole("button", { name: "Filter" }));
    expect(renderedNames()).toEqual(["Lot Charlie"]);
  });

  it("melepas filter menampilkan semua lot lagi", async () => {
    const user = userEvent.setup();
    render(<StockBars rows={rowsWithNulls} />);
    const washedChip = screen.getByRole("button", { name: "Washed" });
    await user.click(washedChip);
    expect(renderedNames()).toEqual(["Lot Alpha"]);
    await user.click(washedChip);
    // Default sort (stok menurun) balik berlaku: Alpha 300, Beta 200, Charlie 100, Delta 50.
    expect(renderedNames()).toEqual(["Lot Alpha", "Lot Beta", "Lot Charlie", "Lot Delta"]);
  });

  it("grup filter gak dirender kalau gak ada lot dengan nilai di dimensi itu", () => {
    render(
      <StockBars
        rows={[{ id: 1, name: "Lot Solo", stock: 10, roastDate: "2024-01-01", processMethod: null, roastProfile: null }]}
      />,
    );
    expect(screen.queryByText("Proses")).toBeNull();
    expect(screen.queryByText("Profil roast")).toBeNull();
  });

  it("hasil filter kosong menampilkan pesan, bukan list kosong", async () => {
    const user = userEvent.setup();
    render(<StockBars rows={rows} />);
    await user.click(screen.getByRole("button", { name: "Washed" }));
    await user.click(screen.getByRole("button", { name: "Omniroast" }));
    expect(screen.getByText("Gak ada lot yang cocok dengan filter.")).toBeDefined();
  });

  it("kombinasi filter tanpa hasil tetap punya jalan kembali lewat Reset filter", async () => {
    const user = userEvent.setup();
    render(<StockBars rows={rows} />);
    await user.click(screen.getByRole("button", { name: "Washed" }));
    await user.click(screen.getByRole("button", { name: "Omniroast" }));
    expect(screen.getByText("Gak ada lot yang cocok dengan filter.")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Reset filter" }));
    expect(renderedNames()).toEqual(["Lot Alpha", "Lot Beta", "Lot Charlie"]);
  });
});

describe("StockBars link ke lot", () => {
  it("nama lot adalah link ke /rak#lot-<id>", () => {
    render(<StockBars rows={rows} />);
    const link = screen.getByRole("link", { name: "Lot Alpha" });
    expect(link.getAttribute("href")).toBe("/rak#lot-2");
  });

  it("tiap lot punya link dengan id-nya sendiri, bukan nama yang dipakai bareng", () => {
    render(<StockBars rows={rows} />);
    expect(screen.getByRole("link", { name: "Lot Charlie" }).getAttribute("href")).toBe("/rak#lot-1");
    expect(screen.getByRole("link", { name: "Lot Beta" }).getAttribute("href")).toBe("/rak#lot-3");
  });
});

describe("StockBars umur roast", () => {
  it("umur lot lama tetap angka polos, tanpa label atau warna kualitas", () => {
    // Lot Beta di-roast 2020-01-01 -- jauh lebih dari 30 hari yang lalu di
    // tanggal berapa pun test ini jalan.
    render(<StockBars rows={rows} />);
    expect(screen.queryByText(/lewat masa prima/)).toBeNull();
    expect(screen.getAllByText(/^\d+ hari sejak roast$/).length).toBe(rows.length);
  });
});

describe("StockBars aria-pressed & Reset filter", () => {
  it("chip mengumumkan state terpilihnya lewat aria-pressed", async () => {
    const user = userEvent.setup();
    render(<StockBars rows={rowsWithNulls} />);
    const chip = screen.getByRole("button", { name: "Washed" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    await user.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    await user.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("false");
  });

  it("Reset filter tidak tampil kalau belum ada filter aktif", () => {
    render(<StockBars rows={rowsWithNulls} />);
    expect(screen.queryByRole("button", { name: "Reset filter" })).toBeNull();
  });

  it("Reset filter menghapus filter proses dan profil roast sekaligus", async () => {
    const user = userEvent.setup();
    render(<StockBars rows={rowsWithNulls} />);
    await user.click(screen.getByRole("button", { name: "Natural" }));
    await user.click(screen.getByRole("button", { name: "Filter" }));
    expect(renderedNames()).toEqual(["Lot Charlie"]);

    await user.click(screen.getByRole("button", { name: "Reset filter" }));

    expect(screen.getByRole("button", { name: "Natural" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Filter" }).getAttribute("aria-pressed")).toBe("false");
    // Default sort (stok menurun) balik berlaku, semua lot tampil lagi.
    expect(renderedNames()).toEqual(["Lot Alpha", "Lot Beta", "Lot Charlie", "Lot Delta"]);
  });
});

describe("StockBars jumlah hasil dan teks penjelas", () => {
  it("menampilkan jumlah hasil dari total, dan ikut berubah saat difilter", async () => {
    const user = userEvent.setup();
    render(<StockBars rows={rowsWithNulls} />);
    expect(screen.getByText("4 dari 4 lot")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Washed" }));
    expect(screen.getByText("1 dari 4 lot")).toBeDefined();
  });

  it("menjelaskan skala bar dan ruang lingkup filter", () => {
    render(<StockBars rows={rows} />);
    expect(screen.getByText("Panjang bar dibandingkan stok terbesar dalam hasil ini.")).toBeDefined();
    expect(screen.getByText(/Filter hanya untuk Stok per lot/)).toBeDefined();
  });
});
