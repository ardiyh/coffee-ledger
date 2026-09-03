import { findRegion } from "@/lib/regions";
import { indonesiaPath, project, MAP_SIZE } from "@/lib/geo/project";
import { formatGrams } from "@/lib/format";

const MIN_RADIUS = 4;
const MAX_RADIUS = 10;

/**
 * Peta origin lot aktif. Hanya lot berstok > 0 yang seharusnya dioper masuk
 * (caller menyaring itu) — peta ini menjawab "dari mana kopi yang lagi ada
 * sekarang", bukan sejarah semua lot yang pernah ada.
 *
 * Jari-jari titik mengikuti akar kuadrat stok relatif terhadap stok
 * terbesar, karena yang mau dibandingkan mata itu luas lingkaran, bukan
 * jari-jarinya — kalau linear, lot dua kali lebih besar akan kelihatan
 * empat kali lebih mencolok.
 */
export function OriginMap({
  lots,
}: {
  lots: { name: string; stock: number; origin: string }[];
}) {
  const maxStock = Math.max(0, ...lots.map((l) => l.stock));
  const placed = lots
    .map((l) => ({ ...l, region: findRegion(l.origin) }))
    .filter((l) => l.region !== undefined) as {
    name: string;
    stock: number;
    origin: string;
    region: NonNullable<ReturnType<typeof findRegion>>;
  }[];
  const unplacedCount = lots.length - placed.length;

  return (
    <section className="rounded-lg border border-line bg-panel p-6">
      <h2 className="mb-6 font-display text-base font-medium text-ink">
        Peta lot aktif
      </h2>
      <svg
        viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`}
        className="w-full h-auto"
      >
        <path
          d={indonesiaPath()}
          fill="var(--panel-2)"
          stroke="var(--line)"
          strokeWidth="1"
        />
        {placed.map((l) => {
          const { x, y } = project(l.region.lon, l.region.lat);
          const ratio = maxStock > 0 ? l.stock / maxStock : 0;
          const r = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(ratio);
          return (
            <circle key={l.name} cx={x} cy={y} r={r} fill="var(--amber)">
              {/*
                React requires <title> children to collapse to a single
                string (it errors on an array of nodes here, unlike other
                elements), so this is a template literal, not interpolated
                JSX text nodes.
              */}
              <title>{`${l.name} — ${formatGrams(l.stock)}`}</title>
            </circle>
          );
        })}
      </svg>
      {unplacedCount > 0 ? (
        <p className="mt-3 font-body text-xs text-ink-faint">
          {unplacedCount} lot gak kegambar: origin-nya gak ada di daftar
          region.
        </p>
      ) : null}
    </section>
  );
}
