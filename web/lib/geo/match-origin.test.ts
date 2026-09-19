import { describe, expect, it } from "vitest";
import { matchOrigin, type WorldCountry } from "./match-origin";

const worldCountries: WorldCountry[] = [
  { name: "Indonesia", lat: -2.5, lon: 118 },
  { name: "El Salvador", lat: 13.7, lon: -88.9 },
  { name: "Ethiopia", lat: 8.6, lon: 39.6 },
  { name: "Colombia", lat: 3.9, lon: -73.1 },
];

const provinces: WorldCountry[] = [
  { name: "Jawa Barat", lat: -6.9, lon: 107.6 },
  { name: "Aceh", lat: 4.5, lon: 96.5 },
];

describe("matchOrigin", () => {
  it("mencocokkan origin yang menyebut negara luar Indonesia", () => {
    const result = matchOrigin(
      "El Salvador, Roasted by Ease Coffee (Chiba, Japan)",
      worldCountries,
      provinces,
    );
    expect(result).toEqual({ kind: "country", name: "El Salvador", lat: 13.7, lon: -88.9 });
  });

  it("tidak peka besar-kecil huruf", () => {
    const result = matchOrigin("EL SALVADOR", worldCountries, provinces);
    expect(result?.name).toBe("El Salvador");
  });

  it("mencocokkan origin yang menyebut provinsi Indonesia", () => {
    const result = matchOrigin("Manglayang, Jawa Barat", worldCountries, provinces);
    expect(result).toEqual({ kind: "province", name: "Jawa Barat", lat: -6.9, lon: 107.6 });
  });

  it("mencocokkan provinsi yang sama dari origin lain yang berbeda", () => {
    const result = matchOrigin("Mekarwangi, Jawa Barat", worldCountries, provinces);
    expect(result?.name).toBe("Jawa Barat");
  });

  it('negara "Indonesia" sendiri gak pernah dicocokkan lewat lapis negara', () => {
    const result = matchOrigin("Indonesia", worldCountries, provinces);
    expect(result).toBeUndefined();
  });

  it("origin yang gak menyebut negara atau provinsi manapun tidak cocok", () => {
    const result = matchOrigin("Entah dari mana", worldCountries, provinces);
    expect(result).toBeUndefined();
  });

  it("nama yang lebih panjang/spesifik menang atas substring yang lebih pendek", () => {
    const countries: WorldCountry[] = [
      { name: "Guinea", lat: 10, lon: -10 },
      { name: "Guinea-Bissau", lat: 12, lon: -15 },
      { name: "Indonesia", lat: -2.5, lon: 118 },
    ];
    const result = matchOrigin("Coffee from Guinea-Bissau", countries, []);
    expect(result?.name).toBe("Guinea-Bissau");
  });

  it("nama provinsi yang jadi substring kota lain gak salah kecocok (word boundary)", () => {
    const provincesWithBali: WorldCountry[] = [{ name: "Bali", lat: -8.4, lon: 115.2 }];
    const result = matchOrigin("Roasted in Balikpapan", [], provincesWithBali);
    expect(result).toBeUndefined();
  });

  it("nama negara yang jadi substring negara lain gak salah kecocok (word boundary)", () => {
    const countries: WorldCountry[] = [{ name: "Mali", lat: 17, lon: -4 }];
    const result = matchOrigin("Coffee from Somalia", countries, []);
    expect(result).toBeUndefined();
  });
});
