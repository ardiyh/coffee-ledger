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
