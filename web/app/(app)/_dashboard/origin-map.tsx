"use client";

import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
  useZoomPanContext,
} from "react-simple-maps";
import { matchOrigin, type MatchedPlace } from "@/lib/geo/match-origin";
import { computeInitialView } from "@/lib/geo/initial-view";
import { WORLD_COUNTRIES, WORLD_COUNTRIES_GEOJSON } from "@/lib/geo/world-countries";
import { INDONESIA_PROVINCES } from "@/lib/geo/provinces";
import { formatGrams } from "@/lib/format";

const MIN_RADIUS = 4;
const MAX_RADIUS = 10;
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const ZOOM_STEP = 1.5;

const buttonClass =
  "rounded-full border border-line px-3 py-1.5 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber";

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

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

type Lot = { name: string; stock: number; origin: string };
type MatchedLot = Lot & { place: MatchedPlace | undefined };
type PlacedLot = Lot & { place: MatchedPlace };

function isPlaced(lot: MatchedLot): lot is PlacedLot {
  return lot.place !== undefined;
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
 *
 * Setiap lot dicocokkan sekali (`matched`), lalu marker, daftar terpetakan,
 * dan angka cakupan semua membaca hasil yang sama -- supaya ketiganya gak
 * pernah beda pendapat soal lot mana yang "kegambar". Lot yang origin-nya
 * gak dikenali gak dibuang diam-diam: mereka masuk daftar fallback sendiri
 * (nama, origin asli, gram), bukan cuma dihitung.
 */
export function OriginMap({ lots }: { lots: Lot[] }) {
  const matched: MatchedLot[] = lots.map((lot) => ({
    ...lot,
    place: matchOrigin(lot.origin, WORLD_COUNTRIES, INDONESIA_PROVINCES),
  }));
  const placed = matched.filter(isPlaced);
  const unplaced = matched.filter((lot) => lot.place === undefined);

  // Group by place: two lots with the same matched country/province project
  // to the exact same coordinate, so plotting them as separate circles just
  // stacks one invisibly on top of the other. One marker per place, sized by
  // combined stock, and the companion list below reads this same grouping
  // so the two never disagree.
  const byPlace = new Map<string, { place: MatchedPlace; stock: number; count: number }>();
  for (const lot of placed) {
    const key = `${lot.place.kind}:${lot.place.name}`;
    const existing = byPlace.get(key);
    if (existing) {
      existing.stock += lot.stock;
      existing.count += 1;
    } else {
      byPlace.set(key, { place: lot.place, stock: lot.stock, count: 1 });
    }
  }
  const grouped = [...byPlace.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.stock - a.stock);
  const maxStock = Math.max(0, ...grouped.map((g) => g.stock));

  // Lazy initializer runs once on mount only -- re-renders from new `lots`
  // props (e.g. a stock edit elsewhere on the dashboard) must not yank the
  // user's pan/zoom back to the initial framing. Reset peta re-derives this
  // same computeInitialView call from whatever `grouped` is *at click time*,
  // so a reset after new data still frames the current lots, not stale ones.
  const [view, setView] = useState<{ center: [number, number]; zoom: number }>(() =>
    computeInitialView(grouped.map((g) => g.place)),
  );

  function handleZoomIn() {
    setView((v) => ({ ...v, zoom: clampZoom(v.zoom * ZOOM_STEP) }));
  }
  function handleZoomOut() {
    setView((v) => ({ ...v, zoom: clampZoom(v.zoom / ZOOM_STEP) }));
  }
  function handleReset() {
    setView(computeInitialView(grouped.map((g) => g.place)));
  }
  function handleMoveEnd(event: { coordinates?: [number, number]; zoom?: number }) {
    setView((v) => ({
      center: event.coordinates ?? v.center,
      zoom: clampZoom(event.zoom ?? v.zoom),
    }));
  }

  return (
    <section className="rounded-lg border border-line bg-panel p-6">
      <h2 className="mb-2 font-display text-base font-medium text-ink">
        Peta lot aktif
      </h2>
      <p className="font-body text-xs text-ink-faint">
        Lokasi perkiraan tingkat provinsi atau negara, bukan lokasi kebun.
      </p>
      <p className="mt-1 font-body text-xs text-ink-faint">
        {lots.length === 0 ? "Belum ada lot aktif" : `${placed.length} dari ${lots.length} lot terpetakan`}
      </p>

      <div className="mb-4 mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleZoomIn} className={buttonClass}>
          Perbesar
        </button>
        <button type="button" onClick={handleZoomOut} className={buttonClass}>
          Perkecil
        </button>
        <button type="button" onClick={handleReset} className={buttonClass}>
          Reset peta
        </button>
        <span className="font-body text-xs text-ink-faint">
          Tahan Ctrl atau ⌘ sambil scroll buat zoom.
        </span>
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 100 }}
        width={760}
        height={400}
        role="img"
        aria-label="Peta asal kopi"
        className="w-full h-auto rounded-md"
        style={{ background: "var(--ground)", touchAction: "pan-y" }}
      >
        <ZoomableGroup
          center={view.center}
          zoom={view.zoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onMoveEnd={handleMoveEnd}
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
                  tabIndex={-1}
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

      {unplaced.length > 0 ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 font-body text-xs uppercase tracking-wide text-ink-faint">
            Belum terpetakan
          </p>
          <ul className="flex flex-col gap-2">
            {unplaced.map((lot, index) => (
              <li
                key={`${lot.name}-${index}`}
                className="flex items-baseline justify-between gap-3 font-body text-sm"
              >
                <span className="min-w-0 text-ink [overflow-wrap:anywhere]">
                  {lot.name}{" "}
                  <span className="font-mono text-xs text-ink-faint">
                    · {lot.origin}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap font-mono tabular-nums text-ink-dim">
                  {formatGrams(lot.stock)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
