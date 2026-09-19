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
});
