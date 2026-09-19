// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Recipients } from "./recipients";

const eightRows = Array.from({ length: 8 }, (_, i) => ({
  recipient: `Penerima ${i + 1}`,
  grams: 800 - i * 10,
}));

const tenRows = [
  ...eightRows,
  { recipient: "Penerima 9", grams: 50 },
  { recipient: "Penerima 10", grams: 10 },
];

afterEach(cleanup);

describe("Recipients", () => {
  it("menjelaskan bahwa daftar dikelompokkan dari catatan transaksi hadiah, sepanjang waktu", () => {
    render(<Recipients rows={eightRows} />);
    expect(screen.getByText("Sepanjang waktu -- dikelompokkan dari catatan transaksi hadiah")).toBeDefined();
  });

  it("data kosong tidak merender bar atau disclosure", () => {
    const { container } = render(<Recipients rows={[]} />);
    expect(screen.queryByText(/Penerima/)).toBeNull();
    expect(container.querySelector("details")).toBeNull();
  });

  it("delapan penerima atau kurang tidak menampilkan disclosure", () => {
    render(<Recipients rows={eightRows} />);
    for (const r of eightRows) {
      expect(screen.getByText(r.recipient)).toBeDefined();
    }
    expect(screen.queryByText("Lihat semua penerima")).toBeNull();
  });

  it("lebih dari delapan penerima menyediakan disclosure yang bisa dibuka dan ditutup", async () => {
    const user = userEvent.setup();
    const { container } = render(<Recipients rows={tenRows} />);

    // Delapan pertama selalu tampil di luar disclosure.
    for (const r of eightRows) {
      expect(screen.getByText(r.recipient)).toBeDefined();
    }

    const details = container.querySelector("details")!;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
    expect(screen.getByText("Lihat semua penerima")).toBeDefined();

    await user.click(screen.getByText("Lihat semua penerima"));
    expect(details.open).toBe(true);
    expect(screen.getByText("Penerima 9")).toBeDefined();
    expect(screen.getByText("Penerima 10")).toBeDefined();

    await user.click(screen.getByText("Lihat semua penerima"));
    expect(details.open).toBe(false);
  });
});
