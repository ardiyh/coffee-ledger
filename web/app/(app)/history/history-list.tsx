"use client";

import { useState } from "react";
import { formatGrams, formatWIB } from "@/lib/format";
import type { TxnReason } from "@/lib/ledger/repository";

export const REASON_LABELS: Record<TxnReason, string> = {
  ACQUIRE: "Masuk / beli",
  BREW: "Seduh",
  GIFT: "Kasih orang",
  ADJUST: "Koreksi",
};

/**
 * Plain, serializable view of a transaction -- no `Date` crosses the
 * server/client boundary here. `ts` is an ISO string, serialized in
 * page.tsx before this component ever sees it.
 */
export interface HistoryTxnItem {
  id: number;
  lotId: number;
  ts: string;
  kind: "IN" | "OUT";
  reason: TxnReason;
  grams: number;
  note: string | null;
}

export interface HistoryLotOption {
  id: number;
  name: string;
}

const inputClass =
  "rounded-md border border-line bg-panel-2 px-2 py-1.5 font-body text-sm text-ink focus:border-amber focus:outline-none";
const labelClass = "font-body text-xs uppercase tracking-wide text-ink-faint";

/**
 * WIB calendar-day string (YYYY-MM-DD) for a UTC ISO timestamp.
 *
 * Different concern from `formatWIB`: that one builds a human display
 * string, this one builds a comparison key. Date-range filtering compares
 * calendar days, not instants -- `2026-09-18T17:00:00Z` is already
 * 19 September in Jakarta (UTC+7, no DST), so it must land on the 19th's
 * side of a day-boundary filter even though its UTC calendar date is still
 * the 18th.
 */
const wibDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(iso));

/**
 * Riwayat: filter lot/alasan/rentang tanggal di atas dataset yang sudah
 * dimuat page.tsx -- tidak ada query backend baru (lihat catatan di sana).
 * CSV tetap seluruh riwayat, tidak kena filter ini sama sekali.
 *
 * `initialLotId` datang dari `?lot=ID` pada tautan receipt (lihat
 * rak/lot-list.tsx: "Lihat riwayat"). Itu prop, bukan state lokal -- dan
 * berpindah dari satu tautan receipt ke lot lain sambil masih di halaman
 * ini adalah navigasi client-side: page.tsx di-render ulang dengan
 * `initialLotId` baru, tapi HistoryList tidak remount, jadi filter lot
 * lokal perlu disamakan ke prop setiap kali prop itu benar-benar berubah.
 * "Reset filter" tetap independen dari mekanisme ini: reset selalu balik
 * ke "semua lot", walau user datang lewat tautan `?lot=` dan
 * `initialLotId` sendiri tidak berubah saat reset.
 *
 * Disamakan saat render, bukan lewat useEffect + setState (dilarang lint
 * react-hooks/set-state-in-effect di proyek ini, lihat komentar
 * stockRevision di rak/lot-list.tsx untuk kasus serupa) -- ini pola
 * "Adjusting state when a prop changes" dari dokumentasi React: bandingkan
 * terhadap prop sebelumnya yang disimpan di state, dan panggil setState
 * kondisional langsung di body render. React membatalkan render itu dan
 * langsung me-render ulang dengan state baru sebelum browser sempat
 * menggambar apa pun, jadi tidak ada flash filter lama.
 */
export function HistoryList({
  transactions,
  lots,
  initialLotId,
}: {
  transactions: HistoryTxnItem[];
  lots: HistoryLotOption[];
  initialLotId: number | null;
}) {
  const [lotFilter, setLotFilter] = useState<number | null>(initialLotId);
  const [prevInitialLotId, setPrevInitialLotId] = useState(initialLotId);
  if (initialLotId !== prevInitialLotId) {
    setPrevInitialLotId(initialLotId);
    setLotFilter(initialLotId);
  }
  const [reasonFilter, setReasonFilter] = useState<TxnReason | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const lotNames = new Map(lots.map((l) => [l.id, l.name]));

  // <input type="date"> already gives YYYY-MM-DD, so plain string
  // comparison matches calendar order. If start > end, don't silently
  // swap them -- just say so near the controls and skip date filtering
  // entirely until the user fixes it.
  const dateRangeInvalid = startDate !== "" && endDate !== "" && startDate > endDate;

  const filtered = transactions.filter((t) => {
    if (lotFilter !== null && t.lotId !== lotFilter) return false;
    if (reasonFilter !== "all" && t.reason !== reasonFilter) return false;
    if (!dateRangeInvalid) {
      const day = wibDay(t.ts);
      if (startDate !== "" && day < startDate) return false;
      if (endDate !== "" && day > endDate) return false;
    }
    return true;
  });

  // Newest first; ties (identical timestamp) broken by id descending, so
  // the order is fully deterministic instead of depending on incoming
  // dataset order for same-instant transactions.
  const sorted = [...filtered].sort((a, b) => {
    const tsCmp = new Date(b.ts).getTime() - new Date(a.ts).getTime();
    return tsCmp !== 0 ? tsCmp : b.id - a.id;
  });

  function resetFilters() {
    setLotFilter(null);
    setReasonFilter("all");
    setStartDate("");
    setEndDate("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Lot</span>
          <select
            value={lotFilter ?? ""}
            onChange={(event) =>
              setLotFilter(event.target.value === "" ? null : Number(event.target.value))
            }
            className={inputClass}
          >
            <option value="">Semua lot</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Alasan</span>
          <select
            value={reasonFilter}
            onChange={(event) => setReasonFilter(event.target.value as TxnReason | "all")}
            className={inputClass}
          >
            <option value="all">Semua alasan</option>
            {(Object.entries(REASON_LABELS) as [TxnReason, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Dari tanggal</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Sampai tanggal</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className={inputClass}
          />
        </label>

        <button
          type="button"
          onClick={resetFilters}
          className="rounded-full border border-line px-4 py-1.5 font-body text-xs text-ink-dim transition-colors hover:border-amber hover:text-amber"
        >
          Reset filter
        </button>
      </div>

      {dateRangeInvalid ? (
        <p role="alert" className="font-body text-xs text-clay-ink">
          Tanggal &quot;Dari&quot; tidak boleh setelah tanggal &quot;Sampai&quot; -- filter tanggal belum diterapkan.
        </p>
      ) : null}

      <p className="font-body text-xs text-ink-faint">
        Menampilkan {sorted.length} dari {transactions.length} transaksi
      </p>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-line bg-panel p-10 text-center">
          <p className="font-body text-sm text-ink-dim">
            Tidak ada transaksi yang cocok dengan filter ini.
          </p>
        </div>
      ) : (
        <>
          {/*
            Mobile: cards, not a horizontally-scrolled table. The five-column
            table overflows a 390px screen wide enough that grams and notes --
            the numbers that actually answer "how much moved" -- sit past the
            fold by default. Sign + grams lead each card; reason and time
            follow; the note, if any, trails last.
          */}
          <ul className="flex flex-col gap-3 sm:hidden">
            {sorted.map((t) => {
              const isIn = t.kind === "IN";
              return (
                <li key={t.id} className="rounded-lg border border-line bg-panel p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 flex-1 font-body text-sm text-ink [overflow-wrap:anywhere]">
                      {lotNames.get(t.lotId) ?? `Lot ${t.lotId}`}
                    </span>
                    <span
                      className={`shrink-0 whitespace-nowrap font-mono text-sm tabular-nums ${
                        isIn ? "text-teal" : "text-clay-ink"
                      }`}
                    >
                      {isIn ? "+" : "−"}
                      {formatGrams(t.grams)}
                    </span>
                  </div>
                  <p className="mt-1 font-body text-xs text-ink-faint">
                    {REASON_LABELS[t.reason]} · {formatWIB(new Date(t.ts))}
                  </p>
                  {t.note ? (
                    <p className="mt-1 font-body text-xs text-ink-dim [overflow-wrap:anywhere]">
                      {t.note}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border border-line bg-panel sm:block">
            <table className="w-full border-collapse font-body text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                    Waktu
                  </th>
                  <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                    Lot
                  </th>
                  <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                    Alasan
                  </th>
                  <th className="px-4 py-3 text-right font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                    Gram
                  </th>
                  <th className="px-4 py-3 font-mono text-xs font-normal uppercase tracking-wide text-ink-faint">
                    Catatan
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  // Sign is the primary encoding, colour reinforces it. Never
                  // colour by reason -- ADJUST goes both ways, so that would lie.
                  const isIn = t.kind === "IN";
                  return (
                    <tr key={t.id} className="border-b border-line last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-ink-dim">
                        {formatWIB(new Date(t.ts))}
                      </td>
                      <td className="px-4 py-3 text-ink">
                        {lotNames.get(t.lotId) ?? `Lot ${t.lotId}`}
                      </td>
                      <td className="px-4 py-3 text-ink-dim">{REASON_LABELS[t.reason]}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums ${
                          isIn ? "text-teal" : "text-clay-ink"
                        }`}
                      >
                        {isIn ? "+" : "−"}
                        {formatGrams(t.grams)}
                      </td>
                      <td className="px-4 py-3 text-ink-dim">{t.note ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
