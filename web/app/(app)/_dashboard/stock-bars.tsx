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
 * fitur -- pilihan sort/arah cuma state komponen ini, reset tiap reload.
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

  const sorted = [...rows].sort((a, b) => {
    const cmp =
      sortKey === "name" ? a.name.localeCompare(b.name) :
      sortKey === "daysSinceRoast" ? daysSince(a.roastDate) - daysSince(b.roastDate) :
      a.stock - b.stock;
    return sortDir === "asc" ? cmp : -cmp;
  });
  const maxStock = rows.reduce((max, r) => Math.max(max, r.stock), 0);

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
    </section>
  );
}
