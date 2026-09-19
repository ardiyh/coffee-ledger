// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Reveal } from "./reveal";

afterEach(cleanup);

describe("Reveal", () => {
  it("merender konten terlihat sejak render pertama, tanpa keadaan tersembunyi menunggu efek", () => {
    render(
      <Reveal className="custom-class">
        <p>Konten landing</p>
      </Reveal>,
    );

    // Sinkron, tanpa act()/waitFor() -- kalau ada mekanisme observer/opacity
    // tersisa, ini akan lolos secara kebetulan (isinya tetap ada di DOM),
    // jadi asersi di bawah memeriksa langsung ketiadaan mekanisme itu, bukan
    // cuma keberadaan kontennya.
    const content = screen.getByText("Konten landing");
    expect(content).toBeDefined();

    const wrapper = content.parentElement as HTMLElement;
    expect(wrapper.className).toBe("custom-class");
    expect(wrapper.className).not.toMatch(/reveal/);
    // Tidak ada style opacity/transform inline yang menunggu dibalik oleh
    // IntersectionObserver -- wrapper tidak punya atribut style sama sekali.
    expect(wrapper.hasAttribute("style")).toBe(false);
  });

  it("menerima delayMs tanpa menyembunyikan atau menunda konten", () => {
    render(
      <Reveal delayMs={80}>
        <span>Isi kedua</span>
      </Reveal>,
    );
    expect(screen.getByText("Isi kedua")).toBeDefined();
  });

  it("default className kosong tetap merender tanpa kelas reveal/reveal-visible", () => {
    render(
      <Reveal>
        <span>Isi ketiga</span>
      </Reveal>,
    );
    const wrapper = screen.getByText("Isi ketiga").parentElement as HTMLElement;
    expect(wrapper.className).not.toMatch(/reveal/);
  });
});
