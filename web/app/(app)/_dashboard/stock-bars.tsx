"use client";

import { useState } from "react";
import { daysSince, formatGrams } from "@/lib/format";
import { BarRow } from "./bar-row";

type SortKey = "stock" | "name" | "daysSinceRoast";
type SortDirection = "asc" | "desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "stock", label: "Stok" },
  { value: "name", label: "Nama" },
  { value: "daysSinceRoast", label: "Hari sejak roast" },
];

const selectClass =
  "rounded-md border border-line bg-panel-2 px-2 py-1.5 font-body text-sm text-ink focus:border-amber focus:outline-none";

function chipClass(active: boolean) {
  return active
    ? "rounded-full border border-amber bg-amber px-3 py-1 font-body text-xs font-semibold text-ground transition-colors"
    : "rounded-full border border-line px-3 py-1 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber";
}

function toggleValue(value: string, selected: string[]): string[] {
  return selected.includes(value)
    ? selected.filter((v) => v !== value)
    : [...selected, value];
}

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null))].sort();
}

/**
 * Bar stok per lot, satu hue amber — bar mengodekan besaran, bukan identitas
 * lot, jadi tidak ada warna per lot di sini.
 *
 * Baris kedua kecil di bawah nama lot menampilkan umur roast sebagai angka
 * plus label, bukan lampu lalu lintas: skalanya kontinu dan ambang "lewat
 * masa prima" itu selera, jadi warna status merah/kuning/hijau akan
 * berbohong soal presisi yang sebenarnya tidak ada.
 *
 * Urutan default (stok menurun) sama seperti sebelum sort dipilihkan jadi
 * fitur -- pilihan sort/arah/filter cuma state komponen ini, reset tiap
 * reload. Filter proses & profil roast bersifat AND antar dimensi, OR di
 * dalam satu dimensi (checklist multi-value); opsinya diturunkan dari lot
 * yang lagi ada, bukan daftar tetap, jadi gak ada tombol filter yang
 * hasilnya pasti kosong.
 */
export function StockBars({
  rows,
}: {
  rows: {
    id: number;
    name: string;
    stock: number;
    roastDate: string;
    processMethod: string | null;
    roastProfile: string | null;
  }[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("stock");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [processFilter, setProcessFilter] = useState<string[]>([]);
  const [roastProfileFilter, setRoastProfileFilter] = useState<string[]>([]);

  const processOptions = uniqueSorted(rows.map((r) => r.processMethod));
  const roastProfileOptions = uniqueSorted(rows.map((r) => r.roastProfile));

  const filtered = rows.filter((r) =>
    (processFilter.length === 0 || (r.processMethod !== null && processFilter.includes(r.processMethod))) &&
    (roastProfileFilter.length === 0 || (r.roastProfile !== null && roastProfileFilter.includes(r.roastProfile))),
  );
  const sorted = [...filtered].sort((a, b) => {
    const cmp =
      sortKey === "name" ? a.name.localeCompare(b.name) :
      sortKey === "daysSinceRoast" ? daysSince(a.roastDate) - daysSince(b.roastDate) :
      a.stock - b.stock;
    return sortDir === "asc" ? cmp : -cmp;
  });
  const maxStock = filtered.reduce((max, r) => Math.max(max, r.stock), 0);

  return (
    <section className="rounded-lg border border-line bg-panel p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-medium text-ink">
          Stok per lot
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="font-body text-xs uppercase tracking-wide text-ink-faint">
              Urutkan
            </span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className={selectClass}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            aria-label={sortDir === "asc" ? "Urut naik" : "Urut turun"}
            className="rounded-full border border-line px-3 py-1.5 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber"
          >
            {sortDir === "asc" ? "↑ Naik" : "↓ Turun"}
          </button>
        </div>
      </div>

      {processOptions.length > 0 || roastProfileOptions.length > 0 ? (
        <div className="mb-6 flex flex-col gap-2">
          {processOptions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-body text-xs uppercase tracking-wide text-ink-faint">
                Proses
              </span>
              {processOptions.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProcessFilter(toggleValue(p, processFilter))}
                  className={chipClass(processFilter.includes(p))}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : null}
          {roastProfileOptions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-body text-xs uppercase tracking-wide text-ink-faint">
                Profil roast
              </span>
              {roastProfileOptions.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setRoastProfileFilter(toggleValue(p, roastProfileFilter))}
                  className={chipClass(roastProfileFilter.includes(p))}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <p className="font-body text-sm text-ink-faint">
          Gak ada lot yang cocok dengan filter.
        </p>
      ) : (
        <div className="space-y-4">
          {sorted.map((r) => {
            const pct = maxStock > 0 ? (r.stock / maxStock) * 100 : 0;
            const age = daysSince(r.roastDate);
            const pastPrime = age > 30;
            return (
              <BarRow key={r.id} percent={pct} value={formatGrams(r.stock)} label={
                <>
                  <span>{r.name}</span>
                  <p className="mt-1 font-body text-xs text-ink-faint">
                    {age} hari sejak roast
                    {pastPrime ? " · lewat masa prima" : ""}
                  </p>
                </>
              } />
            );
          })}
        </div>
      )}
    </section>
  );
}
