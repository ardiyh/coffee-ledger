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
 *
 * Keterbatasan yang diketahui: geoCentroid menghitung centroid geometris
 * tunggal, jadi negara dengan wilayah terpisah jauh (mis. Prancis, yang di
 * world-atlas menggabungkan daratan utama dengan Guyana Prancis jadi satu
 * MultiPolygon) bisa dapat titik yang jatuh di laut lepas, bukan di daratan
 * manapun. Diverifikasi tidak berdampak ke negara asal kopi mana pun yang
 * relevan buat app ini (Etiopia, Kolombia, dst semuanya jatuh wajar) -- baru
 * jadi masalah kalau suatu saat negara lain diplot.
 */
export const WORLD_COUNTRIES: WorldCountry[] = WORLD_COUNTRIES_GEOJSON.features.map((f) => {
  const [lon, lat] = geoCentroid(f);
  return { name: f.properties.name, lat, lon };
});
