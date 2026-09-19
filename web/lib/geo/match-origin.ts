export interface WorldCountry {
  name: string;
  lat: number;
  lon: number;
}

export interface MatchedPlace {
  kind: "country" | "province";
  name: string;
  lat: number;
  lon: number;
}

/**
 * Cocokkan teks origin bebas ke satu titik perkiraan. Negara luar Indonesia
 * dicek lebih dulu (nama negara biasanya ditulis eksplisit, mis. "El
 * Salvador"), baru provinsi Indonesia (jarang ditulis kata "Indonesia"
 * sendiri). Nama terpanjang dicek lebih dulu di tiap lapis supaya nama yang
 * jadi substring nama lain (mis. "Guinea" di dalam "Guinea-Bissau") gak
 * keduluan match oleh yang lebih pendek/generik.
 *
 * `worldCountries` dan `provinces` sengaja jadi parameter, bukan di-import
 * langsung -- supaya fungsi ini bisa dites dengan daftar kecil buatan tes,
 * tanpa menyeret world-atlas/d3-geo/react-simple-maps (paket berat, khusus
 * client) ke test suite.
 */

/**
 * Cek apakah `needle` muncul di `haystack` sebagai kata utuh, bukan cuma
 * substring di tengah kata lain -- soalnya "Bali" ada literal di dalam
 * "Balikpapan", dan plain .includes() bakal salah nge-pin ke Bali. Pakai
 * lookbehind/lookahead \p{L}/\p{N} (bukan cuma \b bawaan JS, yang gak
 * anggap huruf beraksen sebagai huruf) supaya nama negara/provinsi yang
 * ada huruf non-ASCII (mis. Côte d'Ivoire) tetap benar.
 */
function containsWholeWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(haystack);
}

export function matchOrigin(
  origin: string,
  worldCountries: readonly WorldCountry[],
  provinces: readonly WorldCountry[],
): MatchedPlace | undefined {
  const country = worldCountries
    .filter((c) => c.name.toLowerCase() !== "indonesia")
    .sort((a, b) => b.name.length - a.name.length)
    .find((c) => containsWholeWord(origin, c.name));
  if (country) {
    return { kind: "country", name: country.name, lat: country.lat, lon: country.lon };
  }

  const province = [...provinces]
    .sort((a, b) => b.name.length - a.name.length)
    .find((p) => containsWholeWord(origin, p.name));
  if (province) {
    return { kind: "province", name: province.name, lat: province.lat, lon: province.lon };
  }

  return undefined;
}
