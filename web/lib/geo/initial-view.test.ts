import { describe, expect, it } from "vitest";
import { computeInitialView } from "./initial-view";

describe("computeInitialView", () => {
  it("kosong -> fallback ke sekitar Indonesia, zoom 1", () => {
    expect(computeInitialView([])).toEqual({ center: [110, -2], zoom: 1 });
  });

  it("satu titik -> center persis di titik itu, zoom besar (span nol)", () => {
    const result = computeInitialView([{ lat: -6.9, lon: 107.6 }]);
    expect(result.center).toEqual([107.6, -6.9]);
    expect(result.zoom).toBe(6);
  });

  it("titik-titik yang berdekatan (sesama Indonesia) -> zoom cukup besar", () => {
    const result = computeInitialView([
      { lat: -6.9, lon: 107.6 },
      { lat: -3.7, lon: 119.9 },
    ]);
    expect(result.zoom).toBeGreaterThanOrEqual(2.5);
  });

  it("titik-titik yang tersebar lintas benua -> zoom kecil (dunia)", () => {
    const result = computeInitialView([
      { lat: -6.9, lon: 107.6 }, // Jawa Barat
      { lat: 13.7, lon: -88.9 }, // El Salvador
      { lat: 8.6, lon: 39.6 }, // Ethiopia
    ]);
    expect(result.zoom).toBe(1);
  });

  it("center adalah titik tengah bounding box, bukan rata-rata semua titik", () => {
    const result = computeInitialView([
      { lat: 0, lon: 0 },
      { lat: 10, lon: 20 },
    ]);
    expect(result.center).toEqual([10, 5]);
  });
});
