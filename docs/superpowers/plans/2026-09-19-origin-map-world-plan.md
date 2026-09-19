# Origin Map World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's Indonesia-only, exact-match origin map with an interactive world map that places lots by province (Indonesia) or country (elsewhere), so lots with origins outside the old 13-entry curated list — currently 6 of 11 active lots — actually show up.

**Architecture:** Two new pure-function modules (`match-origin.ts`, `initial-view.ts`) handle matching and view-framing logic, independently testable with Vitest. A new `world-countries.ts` module computes country centroids once from a bundled `world-atlas` TopoJSON file. `origin-map.tsx` becomes a client component composing these with `react-simple-maps` for rendering + pan/zoom. `web/lib/regions.ts`'s `COFFEE_REGIONS` (used for the add-lot form's datalist) is untouched — this only replaces `findRegion`, its sole map-only consumer.

**Tech Stack:** Next.js 16 App Router (client component), `react-simple-maps` v5, `d3-geo`, `topojson-client`, `world-atlas` (bundled TopoJSON, no runtime network calls), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-origin-map-world-design.md`

**Verified before writing this plan:** all package versions, TypeScript types, and the exact `topojson-client`/`d3-geo`/`react-simple-maps` API calls below were trial-installed and typechecked in a scratch copy of `web/` (React 19 peer-dependency compatibility confirmed; a real compile error was caught and fixed in the `feature<Properties>()` generic usage — the code in Task 4 reflects the corrected, verified version, not a guess).

---

### Task 1: Add new dependencies

**Files:**
- Modify: `web/package.json`

- [x] **Step 1: Add the dependencies**

In `web/package.json`, add to `"dependencies"`:

```json
    "d3-geo": "^3.1.1",
    "react-simple-maps": "^5.0.5",
    "topojson-client": "^3.1.0",
    "world-atlas": "^2.0.2",
```

(Insert alphabetically among the existing entries — the file already keeps `dependencies` roughly alphabetical.)

Add to `"devDependencies"`:

```json
    "@types/topojson-client": "^3.1.5",
```

(`react-simple-maps` ships its own types and already depends on `@types/d3-geo`, `@types/geojson`, and `@types/topojson-specification` transitively, so those don't need to be added explicitly. `topojson-client` itself ships no types, hence `@types/topojson-client` as an explicit devDependency.)

- [x] **Step 2: Install and verify**

Run (from `web/`): `npm install`
Expected: installs cleanly, no peer-dependency conflicts (react-simple-maps 5.x declares `"react": "^16.8.0 || 17.x || 18.x || 19.x"`, matching this project's React 19).

- [x] **Step 3: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/package.json web/package-lock.json
git commit -m "$(cat <<'EOF'
feat: tambah dependency buat peta dunia interaktif

react-simple-maps + d3-geo + topojson-client + world-atlas (data
topologi dibundel statis, nol network call runtime). Peer dependency
React 19 sudah didukung react-simple-maps 5.x.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 2: Provinsi Indonesia — data + tipe bersama

**Files:**
- Create: `web/lib/geo/provinces.ts`

No test — this is a static data file (a literal array), nothing to assert beyond "it exists and has this shape," which the type system already covers.

- [x] **Step 1: Write the file**

Create `web/lib/geo/provinces.ts`:

```ts
export interface WorldCountry {
  name: string;
  lat: number;
  lon: number;
}

/**
 * Titik pusat 38 provinsi Indonesia, buat perkiraan lokasi di peta lot aktif
 * ketika origin sebuah lot menyebut nama provinsinya. Perkiraan kasar (bukan
 * sentroid geografis yang diukur presisi) -- cukup buat "kira-kira di mana",
 * konsisten dengan keputusan bahwa peta ini gak butuh presisi (lihat spec
 * docs/superpowers/specs/2026-09-19-origin-map-world-design.md §1).
 *
 * Terpisah dari `COFFEE_REGIONS` di web/lib/regions.ts: daftar itu tetap
 * dipakai apa adanya buat saran isian form tambah lot (nama daerah kopi
 * spesifik, bukan provinsi) -- dua kebutuhan yang beda, sengaja gak
 * disatukan.
 */
export const INDONESIA_PROVINCES: readonly WorldCountry[] = [
  { name: "Aceh", lat: 4.5, lon: 96.5 },
  { name: "Sumatera Utara", lat: 2.5, lon: 99.0 },
  { name: "Sumatera Barat", lat: -0.9, lon: 100.4 },
  { name: "Riau", lat: 0.5, lon: 101.9 },
  { name: "Jambi", lat: -1.6, lon: 103.6 },
  { name: "Sumatera Selatan", lat: -3.3, lon: 104.0 },
  { name: "Bengkulu", lat: -3.6, lon: 102.3 },
  { name: "Lampung", lat: -4.9, lon: 105.2 },
  { name: "Kepulauan Bangka Belitung", lat: -2.7, lon: 106.4 },
  { name: "Kepulauan Riau", lat: 3.9, lon: 108.1 },
  { name: "DKI Jakarta", lat: -6.2, lon: 106.8 },
  { name: "Jawa Barat", lat: -6.9, lon: 107.6 },
  { name: "Jawa Tengah", lat: -7.2, lon: 110.1 },
  { name: "DI Yogyakarta", lat: -7.8, lon: 110.4 },
  { name: "Jawa Timur", lat: -7.5, lon: 112.2 },
  { name: "Banten", lat: -6.4, lon: 106.1 },
  { name: "Bali", lat: -8.4, lon: 115.2 },
  { name: "Nusa Tenggara Barat", lat: -8.7, lon: 117.4 },
  { name: "Nusa Tenggara Timur", lat: -8.7, lon: 121.1 },
  { name: "Kalimantan Barat", lat: -0.3, lon: 111.5 },
  { name: "Kalimantan Tengah", lat: -1.7, lon: 113.4 },
  { name: "Kalimantan Selatan", lat: -3.1, lon: 115.3 },
  { name: "Kalimantan Timur", lat: 0.5, lon: 116.5 },
  { name: "Kalimantan Utara", lat: 3.1, lon: 116.8 },
  { name: "Sulawesi Utara", lat: 1.2, lon: 124.8 },
  { name: "Sulawesi Tengah", lat: -1.4, lon: 121.4 },
  { name: "Sulawesi Selatan", lat: -3.7, lon: 119.9 },
  { name: "Sulawesi Tenggara", lat: -4.1, lon: 122.2 },
  { name: "Gorontalo", lat: 0.7, lon: 122.4 },
  { name: "Sulawesi Barat", lat: -2.7, lon: 119.2 },
  { name: "Maluku", lat: -3.5, lon: 128.9 },
  { name: "Maluku Utara", lat: 1.5, lon: 127.8 },
  { name: "Papua Barat", lat: -1.3, lon: 133.2 },
  { name: "Papua Barat Daya", lat: -0.9, lon: 132.0 },
  { name: "Papua", lat: -4.5, lon: 138.5 },
  { name: "Papua Tengah", lat: -3.9, lon: 136.9 },
  { name: "Papua Pegunungan", lat: -4.1, lon: 138.9 },
  { name: "Papua Selatan", lat: -7.0, lon: 139.9 },
] as const;
```

- [x] **Step 2: Type-check**

Run (from `web/`): `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 3: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/lib/geo/provinces.ts
git commit -m "$(cat <<'EOF'
feat: daftar 38 provinsi Indonesia buat pencocokan peta

Terpisah dari COFFEE_REGIONS (tetap dipakai apa adanya buat saran
isian form tambah lot) -- daftar ini khusus buat fallback pencocokan
origin ke peta, levelnya provinsi bukan daerah kopi spesifik.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 3: `matchOrigin` — fungsi pencocokan murni

**Files:**
- Create: `web/lib/geo/match-origin.ts`
- Test: `web/lib/geo/match-origin.test.ts`

- [x] **Step 1: Write the failing test**

Create `web/lib/geo/match-origin.test.ts`:

```ts
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
});
```

- [x] **Step 2: Run test to verify it fails**

Run (from `web/`): `npm test -- --run -t matchOrigin`
Expected: FAIL — `Cannot find module './match-origin'` (the file doesn't exist yet).

- [x] **Step 3: Write minimal implementation**

Create `web/lib/geo/match-origin.ts`:

```ts
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
export function matchOrigin(
  origin: string,
  worldCountries: readonly WorldCountry[],
  provinces: readonly WorldCountry[],
): MatchedPlace | undefined {
  const needle = origin.toLowerCase();

  const country = [...worldCountries]
    .filter((c) => c.name.toLowerCase() !== "indonesia")
    .sort((a, b) => b.name.length - a.name.length)
    .find((c) => needle.includes(c.name.toLowerCase()));
  if (country) {
    return { kind: "country", name: country.name, lat: country.lat, lon: country.lon };
  }

  const province = [...provinces]
    .sort((a, b) => b.name.length - a.name.length)
    .find((p) => needle.includes(p.name.toLowerCase()));
  if (province) {
    return { kind: "province", name: province.name, lat: province.lat, lon: province.lon };
  }

  return undefined;
}
```

- [x] **Step 4: Run test to verify it passes**

Run (from `web/`): `npm test -- --run`
Expected: all tests pass, including the 7 new ones in `match-origin.test.ts` (test count goes up
by 7 from wherever it currently stands).

- [x] **Step 5: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/lib/geo/match-origin.ts web/lib/geo/match-origin.test.ts
git commit -m "$(cat <<'EOF'
feat: matchOrigin -- pencocokan origin ke negara/provinsi

Fungsi murni, dua lapis (negara luar Indonesia dulu, baru provinsi
Indonesia), keyword/substring bukan exact-match. Daftar negara &
provinsi jadi parameter supaya testable tanpa dependency peta yang
berat.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 4: `world-countries.ts` — data negara dunia dari `world-atlas`

No automated test — ini modul yang menghitung data dari paket eksternal (`world-atlas`) saat
dimuat; `matchOrigin` yang mengonsumsinya sudah dites terpisah di Task 3 dengan data buatan.
Diverifikasi lewat `tsc --noEmit` di sini, dan pengecekan visual manual di Task 6/7.

**Files:**
- Create: `web/lib/geo/world-countries.ts`

- [x] **Step 1: Write the module**

Create `web/lib/geo/world-countries.ts`:

```ts
import { feature } from "topojson-client";
import { geoCentroid } from "d3-geo";
import countries110m from "world-atlas/countries-110m.json";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { WorldCountry } from "./match-origin";

interface CountryProps {
  name: string;
}

const topology = countries110m as unknown as Topology;

/** GeoJSON penuh (batas negara) -- dipakai <Geographies> buat gambar outline. */
export const WORLD_COUNTRIES_GEOJSON = feature<CountryProps>(
  topology,
  topology.objects.countries as GeometryCollection<CountryProps>,
);

/**
 * Nama negara + titik pusat geografisnya, dihitung sekali saat modul ini
 * dimuat (bukan di-hardcode) -- negara manapun yang ada di world-atlas
 * otomatis kebaca di sini, jadi nambah sourcing dari negara baru gak perlu
 * update daftar manual.
 */
export const WORLD_COUNTRIES: WorldCountry[] = WORLD_COUNTRIES_GEOJSON.features.map((f) => {
  const [lon, lat] = geoCentroid(f);
  return { name: f.properties.name, lat, lon };
});
```

- [x] **Step 2: Type-check**

Run (from `web/`): `npx tsc --noEmit`
Expected: no errors.

(This was verified against the actual installed package types while writing this plan — the
`feature<CountryProps>(topology, topology.objects.countries as GeometryCollection<CountryProps>)`
generic annotation is required; without it, `f.properties` types as `{}` and `f.properties.name`
fails to compile.)

- [x] **Step 3: Sanity-check the computed data**

Run (from `web/`):
```bash
node -e "
const { feature } = require('topojson-client');
const { geoCentroid } = require('d3-geo');
const topology = require('world-atlas/countries-110m.json');
const fc = feature(topology, topology.objects.countries);
const names = fc.features.map(f => f.properties.name);
console.log('total countries:', names.length);
console.log('has El Salvador:', names.includes('El Salvador'));
console.log('has Ethiopia:', names.includes('Ethiopia'));
console.log('has Colombia:', names.includes('Colombia'));
"
```
Expected: `total countries: 177`, all three `has ...` lines `true`.

- [x] **Step 4: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/lib/geo/world-countries.ts
git commit -m "$(cat <<'EOF'
feat: WORLD_COUNTRIES -- centroid semua negara dari world-atlas

Dihitung sekali saat modul dimuat lewat d3-geo geoCentroid, bukan
di-hardcode -- negara baru manapun di world-atlas otomatis kebaca.
Juga expose WORLD_COUNTRIES_GEOJSON buat outline peta.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 5: `computeInitialView` — framing awal peta

**Files:**
- Create: `web/lib/geo/initial-view.ts`
- Test: `web/lib/geo/initial-view.test.ts`

- [x] **Step 1: Write the failing test**

Create `web/lib/geo/initial-view.test.ts`:

```ts
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
```

- [x] **Step 2: Run test to verify it fails**

Run (from `web/`): `npm test -- --run -t computeInitialView`
Expected: FAIL — `Cannot find module './initial-view'`.

- [x] **Step 3: Write minimal implementation**

Create `web/lib/geo/initial-view.ts`:

```ts
export interface GeoPoint {
  lat: number;
  lon: number;
}

const DEFAULT_CENTER: [number, number] = [110, -2]; // sekitar Indonesia

/**
 * Hitung titik tengah & tingkat zoom awal yang membingkai semua titik
 * sekaligus, supaya peta gak selalu mulai dari Indonesia kalau lot aktifnya
 * tersebar di beberapa negara. Heuristik kasar berbasis rentang sudut
 * (bukan perhitungan proyeksi presisi) -- cukup buat "gak ada yang kepotong
 * saat pertama dibuka", bukan pas piksel; pengguna tetap bisa pan/zoom
 * manual dari titik awal ini.
 */
export function computeInitialView(
  points: readonly GeoPoint[],
): { center: [number, number]; zoom: number } {
  if (points.length === 0) {
    return { center: DEFAULT_CENTER, zoom: 1 };
  }

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const span = Math.max(
    Math.max(...lats) - Math.min(...lats),
    Math.max(...lons) - Math.min(...lons),
  );

  let zoom: number;
  if (span > 100) zoom = 1;
  else if (span > 40) zoom = 1.5;
  else if (span > 15) zoom = 2.5;
  else if (span > 5) zoom = 4;
  else zoom = 6;

  return { center: [centerLon, centerLat], zoom };
}
```

- [x] **Step 4: Run test to verify it passes**

Run (from `web/`): `npm test -- --run`
Expected: all tests pass, including the 5 new ones in `initial-view.test.ts`.

- [x] **Step 5: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/lib/geo/initial-view.ts web/lib/geo/initial-view.test.ts
git commit -m "$(cat <<'EOF'
feat: computeInitialView -- framing awal peta ikut sebaran marker

Bounding box dari semua titik aktif, bukan selalu center ke
Indonesia. Heuristik zoom kasar berbasis rentang sudut -- cukup buat
gak ada marker kepotong saat pertama dibuka.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 6: Tulis ulang `OriginMap` pakai `react-simple-maps`

**Files:**
- Modify: `web/app/(app)/_dashboard/origin-map.tsx`

No automated test — komponen rendering peta interaktif, diverifikasi lewat `tsc --noEmit` +
`eslint` di sini, dan pengecekan visual manual di Task 8. Konsisten dengan cakupan test yang
ada di seluruh app ini (berhenti di layer logic, bukan rendering visual).

- [x] **Step 1: Replace the file contents**

Replace the whole file `web/app/(app)/_dashboard/origin-map.tsx` with:

```tsx
"use client";

import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { matchOrigin } from "@/lib/geo/match-origin";
import { computeInitialView } from "@/lib/geo/initial-view";
import { WORLD_COUNTRIES, WORLD_COUNTRIES_GEOJSON } from "@/lib/geo/world-countries";
import { INDONESIA_PROVINCES } from "@/lib/geo/provinces";
import { formatGrams } from "@/lib/format";

const MIN_RADIUS = 4;
const MAX_RADIUS = 10;

/**
 * Peta origin lot aktif. Hanya lot berstok > 0 yang seharusnya dioper masuk
 * (caller menyaring itu) — peta ini menjawab "dari mana kopi yang lagi ada
 * sekarang", bukan sejarah semua lot yang pernah ada.
 *
 * Titik dicocokkan lewat matchOrigin (negara luar Indonesia dulu, baru
 * provinsi Indonesia) -- lihat web/lib/geo/match-origin.ts. Jari-jari titik
 * mengikuti akar kuadrat stok relatif terhadap stok terbesar, karena yang
 * mau dibandingkan mata itu luas lingkaran, bukan jari-jarinya.
 */
export function OriginMap({
  lots,
}: {
  lots: { name: string; stock: number; origin: string }[];
}) {
  const placed = lots
    .map((l) => ({
      ...l,
      place: matchOrigin(l.origin, WORLD_COUNTRIES, INDONESIA_PROVINCES),
    }))
    .filter((l) => l.place !== undefined) as {
    name: string;
    stock: number;
    origin: string;
    place: NonNullable<ReturnType<typeof matchOrigin>>;
  }[];
  const unplacedCount = lots.length - placed.length;

  // Group by place: two lots with the same matched country/province project
  // to the exact same coordinate, so plotting them as separate circles just
  // stacks one invisibly on top of the other. One marker per place, sized by
  // combined stock, and the companion list below reads this same grouping
  // so the two never disagree.
  const byPlace = new Map<
    string,
    { place: (typeof placed)[number]["place"]; stock: number; count: number }
  >();
  for (const l of placed) {
    const existing = byPlace.get(l.place.name);
    if (existing) {
      existing.stock += l.stock;
      existing.count += 1;
    } else {
      byPlace.set(l.place.name, { place: l.place, stock: l.stock, count: 1 });
    }
  }
  const grouped = [...byPlace.values()].sort((a, b) => b.stock - a.stock);
  const maxStock = Math.max(0, ...grouped.map((g) => g.stock));
  const { center, zoom } = computeInitialView(grouped.map((g) => g.place));

  return (
    <section className="rounded-lg border border-line bg-panel p-6">
      <h2 className="mb-6 font-display text-base font-medium text-ink">
        Peta lot aktif
      </h2>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 100 }}
        width={760}
        height={400}
        role="img"
        aria-label="Peta asal kopi"
        className="w-full h-auto rounded-md"
        style={{ background: "var(--ground)" }}
      >
        <ZoomableGroup center={center} zoom={zoom} minZoom={1} maxZoom={20}>
          <Geographies geography={WORLD_COUNTRIES_GEOJSON}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="var(--panel-2)"
                  stroke="var(--line)"
                  strokeWidth={0.5}
                />
              ))
            }
          </Geographies>
          {grouped.map((g) => {
            const ratio = maxStock > 0 ? g.stock / maxStock : 0;
            const r = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(ratio);
            return (
              <Marker key={g.place.name} coordinates={[g.place.lon, g.place.lat]}>
                {/*
                  React requires <title> children to collapse to a single
                  string (it errors on an array of nodes here, unlike other
                  elements), so this is a template literal, not interpolated
                  JSX text nodes. Hover-only, so it's a bonus for mouse
                  users, not the way anyone is meant to read this — the list
                  below carries the same numbers as always-visible text.
                */}
                <circle r={r} fill="var(--amber)">
                  <title>{`${g.place.name} — ${formatGrams(g.stock)}`}</title>
                </circle>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {grouped.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          {grouped.map((g) => (
            <li
              key={g.place.name}
              className="flex items-baseline justify-between gap-3 font-body text-sm"
            >
              <span className="min-w-0 text-ink [overflow-wrap:anywhere]">
                {g.place.name}{" "}
                <span className="font-mono text-xs text-ink-faint">
                  · {g.count} lot
                </span>
              </span>
              <span className="shrink-0 whitespace-nowrap font-mono tabular-nums text-ink-dim">
                {formatGrams(g.stock)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {unplacedCount > 0 ? (
        <p className="mt-3 font-body text-xs text-ink-faint">
          {unplacedCount} lot gak kegambar: origin-nya gak menyebut negara
          atau provinsi yang dikenali.
        </p>
      ) : null}
    </section>
  );
}
```

- [x] **Step 2: Type-check and lint**

Run (from `web/`):
```bash
npx tsc --noEmit
npx eslint "app/(app)/_dashboard/origin-map.tsx"
```
Expected: no errors.

- [x] **Step 3: Run the full test suite (regression check)**

Run (from `web/`): `npm test -- --run`
Expected: all tests still pass (this task doesn't add/remove Vitest tests, only rewrites a
component nothing else imports besides the dashboard page, which isn't touched — its prop
contract, `{ lots: {name, stock, origin}[] }`, is unchanged).

- [x] **Step 4: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add "web/app/(app)/_dashboard/origin-map.tsx"
git commit -m "$(cat <<'EOF'
feat: OriginMap jadi peta dunia interaktif (react-simple-maps)

Ganti SVG Indonesia-only + exact-match 13 daerah, jadi peta dunia
dengan pan/zoom, dicocokkan lewat matchOrigin (negara/provinsi).
Tampilan awal membingkai semua marker aktif lewat computeInitialView.
Prop OriginMap tidak berubah -- caller (dashboard/page.tsx) gak perlu
disentuh.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 7: Hapus kode mati

**Files:**
- Delete: `web/lib/geo/project.ts`
- Delete: `web/lib/geo/indonesia.json`
- Modify: `web/lib/regions.ts` (hapus `findRegion`, pertahankan `CoffeeRegion` dan `COFFEE_REGIONS`)

- [x] **Step 1: Confirm nothing else references the files being deleted**

Run (from repo root):
```bash
grep -rln "geo/project\|geo/indonesia\|findRegion" web --include="*.ts*"
```
Expected output: only `web/lib/regions.ts` (the `findRegion` definition itself, removed in
Step 3 below). If anything else shows up, STOP — something changed since this plan was
written; find out what it is before deleting.

- [x] **Step 2: Delete the two dead files**

```bash
git rm web/lib/geo/project.ts web/lib/geo/indonesia.json
```

- [x] **Step 3: Remove `findRegion` from `regions.ts`**

In `web/lib/regions.ts`, the current file ends with:

```ts
export const COFFEE_REGIONS: readonly CoffeeRegion[] = [
  { name: "Gayo, Aceh", lat: 4.63, lon: 96.85 },
  { name: "Mandailing, Sumatera Utara", lat: 0.79, lon: 99.26 },
  { name: "Lintong, Sumatera Utara", lat: 2.36, lon: 98.93 },
  { name: "Kerinci, Jambi", lat: -1.7, lon: 101.27 },
  { name: "Semendo, Sumatera Selatan", lat: -4.13, lon: 103.6 },
  { name: "Preanger, Jawa Barat", lat: -7.13, lon: 107.62 },
  { name: "Temanggung, Jawa Tengah", lat: -7.32, lon: 110.17 },
  { name: "Ijen, Jawa Timur", lat: -8.06, lon: 114.24 },
  { name: "Kintamani, Bali", lat: -8.25, lon: 115.35 },
  { name: "Bajawa, Flores", lat: -8.79, lon: 120.99 },
  { name: "Toraja, Sulawesi Selatan", lat: -2.97, lon: 119.86 },
  { name: "Rantekarua, Sulawesi Selatan", lat: -2.9, lon: 119.9 },
  { name: "Wamena, Papua Pegunungan", lat: -4.1, lon: 138.95 },
] as const;

/** Cocokkan teks origin ke region yang dikenal. Tidak peka besar-kecil huruf. */
export function findRegion(origin: string): CoffeeRegion | undefined {
  const needle = origin.trim().toLowerCase();
  return COFFEE_REGIONS.find((r) => r.name.toLowerCase() === needle);
}
```

Delete the `findRegion` function (the last 5 lines, from the `/** Cocokkan ... */` comment
through the closing `}`), keeping the `COFFEE_REGIONS` array as-is. The file should end right
after the `] as const;` line.

Also update the file's top doc comment (lines 1-9), which currently says:

```ts
/**
 * Region kopi Indonesia yang dikenal, dengan koordinatnya.
 *
 * Dipakai dua tempat: `<datalist>` di form tambah lot (mempercepat input dan
 * mendorong penulisan origin yang konsisten), dan peta lot aktif di dashboard.
 *
 * Kolom `origin` tetap teks bebas — daftar ini menawarkan, tidak memaksa.
 * Lot dengan origin di luar daftar cukup tidak muncul di peta.
 */
```

Replace it with:

```ts
/**
 * Region kopi Indonesia yang dikenal, dengan koordinatnya.
 *
 * Dipakai buat `<datalist>` di form tambah lot (mempercepat input dan
 * mendorong penulisan origin yang konsisten). Peta lot aktif di dashboard
 * pakai daftar terpisah (web/lib/geo/provinces.ts, level provinsi, bukan
 * daerah spesifik) -- lihat docs/superpowers/specs/2026-09-19-origin-map-world-design.md
 * §3 untuk alasannya.
 *
 * Kolom `origin` tetap teks bebas — daftar ini menawarkan, tidak memaksa.
 */
```

- [x] **Step 4: Type-check, lint, and run the full test suite**

Run (from `web/`):
```bash
npx tsc --noEmit
npx eslint .
npm test -- --run
```
Expected: no type errors, no eslint errors, all tests pass.

- [x] **Step 5: Commit**

```bash
cd /Users/hilmi/orca/workspaces/Coffee/CoffeeData
git add web/lib/regions.ts
git commit -m "$(cat <<'EOF'
chore: hapus kode peta lama (project.ts, indonesia.json, findRegion)

Gak ada lagi pemakainya setelah OriginMap pindah ke
react-simple-maps. COFFEE_REGIONS di regions.ts dipertahankan --
masih dipakai saran isian form tambah lot.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017SaK7MGnLiydHT2ZtcEft6
EOF
)"
```

---

### Task 8: Manual verification in the browser

No code changes — a gate before calling the feature done. Frontend interactivity (pan/zoom,
visual layout, dark-theme styling) isn't covered by the test suite.

- [ ] **Step 1: Start the dev server**

Run (from `web/`): `npm run dev`
Expected: server starts on `http://localhost:3000` with no errors in the terminal.

- [ ] **Step 2: Check the map renders and shows all lots**

Log in, go to `/dashboard`.

- Confirm the "Peta lot aktif" section shows a world map (country outlines visible, dark
  theme colors matching the rest of the app — land in the `--panel-2` tone, sea in `--ground`).
- Confirm markers appear for **all** active lots' origins that mention a recognizable place —
  in particular, the origins that were previously missing: "Manglayang, Jawa Barat",
  "Mekarwangi, Jawa Barat" (should both land on one shared "Jawa Barat" marker), and
  "EL Salvador" (should appear as its own marker, likely far from the Indonesia cluster).
- Confirm the companion list below the map shows entries for "Jawa Barat" and "El Salvador"
  (grouped with the correct lot counts and gram totals) alongside the existing Gayo/Toraja
  entries.
- Confirm the initial view frames all markers without needing to pan first — if Indonesia and
  El Salvador markers are both active, the initial zoom should be pulled back enough to show
  both, not zoomed in on just Indonesia.

- [ ] **Step 3: Check interactivity**

- Scroll/pinch to zoom in and out on the map — confirm it responds smoothly.
- Click-and-drag to pan — confirm it responds.
- Hover a marker — confirm the tooltip (`<title>`) shows the place name and gram total.

- [ ] **Step 4: Check the "unplaced" fallback still works**

If any lot's origin genuinely doesn't mention a recognizable country or province, confirm the
"X lot gak kegambar: ..." text still appears below the map with the correct count. (With
current production data, this should now read 0 lots, or not render at all — if it shows a
count higher than expected, check which origin didn't match and why, since that may reveal a
gap in `INDONESIA_PROVINCES` or a country name spelled differently than `world-atlas` expects.)

- [ ] **Step 5: Confirm the add-lot form's Origin datalist is unaffected**

Go to `/rak`, open "Tambah lot baru", check the Origin field's autocomplete suggestions —
confirm they're still the specific curated regions (e.g. "Gayo, Aceh", "Toraja, Sulawesi
Selatan"), not the new 38-province list. This confirms Task 7's `COFFEE_REGIONS` preservation
worked as intended.

- [ ] **Step 6: Report result**

If everything above matches, the feature is done — no commit needed for this task. If
something doesn't match (e.g. a marker missing, wrong initial framing, a province coordinate
that's visibly off), note exactly what's wrong and fix it as a small follow-up commit before
considering the plan complete.
