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
  const placed = lots
    .map((l) => ({ ...l, region: findRegion(l.origin) }))
    .filter((l) => l.region !== undefined) as {
    name: string;
    stock: number;
    origin: string;
    region: NonNullable<ReturnType<typeof findRegion>>;
  }[];
  const unplacedCount = lots.length - placed.length;

  // Group by region: two lots with the same origin project to the exact same
  // coordinate, so plotting them as separate circles just stacks one
  // invisibly on top of the other. One marker per region, sized by their
  // combined stock, and the companion list below reads this same grouping
  // so the two never disagree.
  const byRegion = new Map<
    string,
    { region: (typeof placed)[number]["region"]; stock: number; count: number }
  >();
  for (const l of placed) {
    const existing = byRegion.get(l.region.name);
    if (existing) {
      existing.stock += l.stock;
      existing.count += 1;
    } else {
      byRegion.set(l.region.name, { region: l.region, stock: l.stock, count: 1 });
    }
  }
  const grouped = [...byRegion.values()].sort((a, b) => b.stock - a.stock);
  const maxStock = Math.max(0, ...grouped.map((g) => g.stock));

  return (
    <section className="rounded-lg border border-line bg-panel p-6">
      <h2 className="mb-6 font-display text-base font-medium text-ink">
        Peta lot aktif
      </h2>
      <svg
        viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`}
        className="w-full h-auto rounded-md"
      >
        {/*
          Laut diberi latar --ground sendiri, bukan mewarisi --panel milik
          kartunya. Daratan --panel-2 di atas panel --panel beda terlalu tipis
          untuk terbaca; di atas --ground perbedaannya cukup.
        */}
        <rect
          width={MAP_SIZE.width}
          height={MAP_SIZE.height}
          fill="var(--ground)"
        />
        <path
          d={indonesiaPath()}
          fill="var(--panel-2)"
          stroke="var(--line)"
          strokeWidth="1"
        />
        {grouped.map((g) => {
          const { x, y } = project(g.region.lon, g.region.lat);
          const ratio = maxStock > 0 ? g.stock / maxStock : 0;
          const r = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(ratio);
          return (
            <circle key={g.region.name} cx={x} cy={y} r={r} fill="var(--amber)">
              {/*
                React requires <title> children to collapse to a single
                string (it errors on an array of nodes here, unlike other
                elements), so this is a template literal, not interpolated
                JSX text nodes. Hover-only, so it's a bonus for mouse users,
                not the way anyone is meant to read this — the list below
                carries the same numbers as always-visible text.
              */}
              <title>{`${g.region.name} — ${formatGrams(g.stock)}`}</title>
            </circle>
          );
        })}
      </svg>

      {grouped.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          {grouped.map((g) => (
            <li
              key={g.region.name}
              className="flex items-baseline justify-between gap-3 font-body text-sm"
            >
              <span className="text-ink">
                {g.region.name}{" "}
                <span className="font-mono text-xs text-ink-faint">
                  · {g.count} lot
                </span>
              </span>
              <span className="font-mono tabular-nums text-ink-dim">
                {formatGrams(g.stock)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {unplacedCount > 0 ? (
        <p className="mt-3 font-body text-xs text-ink-faint">
          {unplacedCount} lot gak kegambar: origin-nya gak ada di daftar
          region.
        </p>
      ) : null}
    </section>
  );
}
