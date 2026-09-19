"use client";

import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
  useZoomPanContext,
} from "react-simple-maps";
import { matchOrigin } from "@/lib/geo/match-origin";
import { computeInitialView } from "@/lib/geo/initial-view";
import { WORLD_COUNTRIES, WORLD_COUNTRIES_GEOJSON } from "@/lib/geo/world-countries";
import { INDONESIA_PROVINCES } from "@/lib/geo/provinces";
import { formatGrams } from "@/lib/format";

const MIN_RADIUS = 4;
const MAX_RADIUS = 10;

/**
 * <ZoomableGroup> applies its pan/zoom transform (translate + scale) to a
 * <g> wrapping all its children, so a plain <circle r={...}> inside a
 * <Marker> scales up visually 1:1 with the map's zoom level. This reads the
 * live zoom scale `k` off the context ZoomableGroup provides (via
 * useZoomPanContext, only readable from a descendant of ZoomableGroup — not
 * from OriginMap itself, which renders ZoomableGroup rather than living
 * inside it) and counter-scales by 1/k so the marker stays a constant `r`
 * on screen regardless of zoom.
 */
function MarkerDot({ r, fill, title }: { r: number; fill: string; title: string }) {
  const { k } = useZoomPanContext();
  return (
    <circle r={r} fill={fill} transform={`scale(${1 / k})`}>
      <title>{title}</title>
    </circle>
  );
}

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
    const key = `${l.place.kind}:${l.place.name}`;
    const existing = byPlace.get(key);
    if (existing) {
      existing.stock += l.stock;
      existing.count += 1;
    } else {
      byPlace.set(key, { place: l.place, stock: l.stock, count: 1 });
    }
  }
  const grouped = [...byPlace.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.stock - a.stock);
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
        <ZoomableGroup
          center={center}
          zoom={zoom}
          minZoom={1}
          maxZoom={20}
          filterZoomEvent={(event) =>
            event.type !== "wheel" || (event as WheelEvent).ctrlKey || (event as WheelEvent).metaKey
          }
        >
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
              <Marker key={g.key} coordinates={[g.place.lon, g.place.lat]}>
                {/*
                  Title text is built here, not inside MarkerDot, so that
                  component stays generic (r/fill/title primitives, no
                  knowledge of `place`/`stock`) — a decoupling choice, not
                  something the <title> element forces. Separately: React
                  requires <title> children to collapse to a single string
                  (it errors on an array of nodes here, unlike other
                  elements), so this is a template literal, not
                  interpolated JSX text nodes. Hover-only, so it's a bonus
                  for mouse users, not the way anyone is meant to read
                  this — the list below carries the same numbers as
                  always-visible text.
                */}
                <MarkerDot
                  r={r}
                  fill="var(--amber)"
                  title={`${g.place.name} — ${formatGrams(g.stock)}`}
                />
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {grouped.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          {grouped.map((g) => (
            <li
              key={g.key}
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
