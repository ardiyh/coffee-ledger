"use client";

import { useState } from "react";
import Link from "next/link";
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
  "min-h-11 rounded-md border border-line bg-panel-2 px-2 py-1.5 font-body text-base sm:text-sm text-ink focus:border-amber focus:outline-none";

function chipClass(active: boolean) {
  return active
    ? "inline-flex h-11 items-center justify-center rounded-full border border-amber bg-amber px-4 font-body text-xs font-semibold text-ground transition-colors"
    : "inline-flex h-11 items-center justify-center rounded-full border border-line px-4 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber";
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
 * lot, jadi tidak ada warna per lot di sini. Panjangnya relatif terhadap
 * lot terbesar di *hasil filter saat ini*, bukan terhadap seluruh rak --
 * makanya ada teks penjelas di bawah judul supaya angka relatif ini gak
 * disalahartikan sebagai perbandingan absolut.
 *
 * Baris kedua kecil di bawah nama lot menampilkan umur roast sebagai angka
 * polos (`daysSince`), bukan lampu lalu lintas atau label "lewat masa
 * prima": skalanya kontinu dan gak ada ambang objektif yang membedakan lot
 * "segar" dari yang "basi", jadi label atau warna status merah/kuning/hijau
 * akan berbohong soal presisi yang sebenarnya tidak ada. Nama lot sendiri
 * adalah link ke `/rak#lot-<id>` -- klik langsung membuka form pencatatan
 * lot itu di Rak, lihat lot-list.tsx untuk sisi yang baca hash ini.
 *
 * Urutan default (stok menurun) sama seperti sebelum sort dipilihkan jadi
 * fitur -- pilihan sort/arah/filter cuma state komponen ini, reset tiap
 * reload. Filter proses & profil roast bersifat AND antar dimensi, OR di
 * dalam satu dimensi (checklist multi-value); opsinya diturunkan dari lot
 * yang lagi ada, bukan daftar tetap, jadi gak ada tombol filter yang
 * hasilnya pasti kosong. Filter ini cuma memengaruhi panel ini -- peta asal
 * dan total di atas tetap menghitung semua lot aktif, jadi ada teks
 * penjelas eksplisit di sini biar gak disangka ikut kefilter.
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
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-medium text-ink">
          Stok per lot
        </h2>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
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
            className="inline-flex h-11 items-center justify-center rounded-full border border-line px-4 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber"
          >
            {sortDir === "asc" ? "↑ Naik" : "↓ Turun"}
          </button>
        </div>
      </div>

      <p className="mb-6 font-body text-xs text-ink-faint">
        Panjang bar dibandingkan stok terbesar dalam hasil ini.
      </p>

      {processOptions.length > 0 || roastProfileOptions.length > 0 ? (
        <div className="mb-6 flex flex-col gap-2">
          <p className="font-body text-xs text-ink-faint">
            Filter hanya untuk Stok per lot -- peta asal dan total di atas tetap menghitung semua lot.
          </p>
          {processOptions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-body text-xs uppercase tracking-wide text-ink-faint">
                Proses
              </span>
              {processOptions.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={processFilter.includes(p)}
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
                  aria-pressed={roastProfileFilter.includes(p)}
                  onClick={() => setRoastProfileFilter(toggleValue(p, roastProfileFilter))}
                  className={chipClass(roastProfileFilter.includes(p))}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : null}
          {processFilter.length > 0 || roastProfileFilter.length > 0 ? (
            <div>
              <button
                type="button"
                onClick={() => {
                  setProcessFilter([]);
                  setRoastProfileFilter([]);
                }}
                className="inline-flex h-11 items-center justify-center rounded-full border border-line px-4 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber"
              >
                Reset filter
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mb-4 font-body text-xs text-ink-faint">
        {sorted.length} dari {rows.length} lot
      </p>

      {sorted.length === 0 ? (
        <p className="font-body text-sm text-ink-faint">
          Gak ada lot yang cocok dengan filter.
        </p>
      ) : (
        <div className="space-y-4">
          {sorted.map((r) => {
            const pct = maxStock > 0 ? (r.stock / maxStock) * 100 : 0;
            const age = daysSince(r.roastDate);
            return (
              <BarRow key={r.id} percent={pct} value={formatGrams(r.stock)} label={
                <>
                  <Link href={`/rak#lot-${r.id}`} className="text-ink hover:text-amber hover:underline">
                    {r.name}
                  </Link>
                  <p className="mt-1 font-body text-xs text-ink-faint">
                    {age} hari sejak roast
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
