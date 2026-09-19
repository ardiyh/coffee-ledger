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

afterEach(cleanup);

function renderedNames() {
  return screen
    .getAllByText(/^Lot (Alpha|Beta|Charlie)$/)
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
