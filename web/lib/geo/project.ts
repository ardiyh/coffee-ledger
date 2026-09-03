import indonesia from "./indonesia.json";

/**
 * Proyeksi linier lon/lat ke koordinat SVG.
 *
 * Bukan proyeksi peta sungguhan. Untuk Indonesia yang membentang di ekuator dan
 * dirender selebar beberapa ratus piksel, distorsinya tidak terlihat, dan ini
 * menghindari ketergantungan pada d3-geo untuk tiga belas poligon.
 */
export const MAP_BOUNDS = { lon0: 94.5, lon1: 141.5, lat0: -11.0, lat1: 6.0 } as const;
export const MAP_SIZE = { width: 760, height: 300 } as const;

export function project(lon: number, lat: number): { x: number; y: number } {
  const { lon0, lon1, lat0, lat1 } = MAP_BOUNDS;
  return {
    x: ((lon - lon0) / (lon1 - lon0)) * MAP_SIZE.width,
    y: ((lat1 - lat) / (lat1 - lat0)) * MAP_SIZE.height,
  };
}

/** Outline Indonesia sebagai satu string `d` untuk `<path>`. */
export function indonesiaPath(): string {
  return (indonesia.coordinates as number[][][][])
    .flatMap((poly) =>
      poly.map((ring) => {
        const pts = ring.map(([lon, lat]) => {
          const { x, y } = project(lon, lat);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        return `M${pts.join("L")}Z`;
      }),
    )
    .join(" ");
}
