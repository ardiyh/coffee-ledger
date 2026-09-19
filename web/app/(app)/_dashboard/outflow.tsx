import { formatGrams } from "@/lib/format";
import { BarRow } from "./bar-row";

const REASON_LABELS: Record<string, string> = {
  GIFT: "Dikasih orang",
  BREW: "Diseduh",
  ADJUST: "Koreksi",
};

/**
 * Ke mana kopi pergi, dipecah per alasan.
 *
 * Sengaja tiga baris satu-hue-amber, bukan satu stacked bar: trio
 * amber-teal-clay gagal uji buta warna pada pasangan amber/clay (ΔE 12,9,
 * di bawah ambang 15), dan tiga baris terpisah menghindari masalah itu sama
 * sekali.
 */
export function Outflow({
  rows,
}: {
  rows: { reason: string; grams: number }[];
}) {
  const total = rows.reduce((sum, r) => sum + r.grams, 0);
  const max = rows[0]?.grams ?? 0;

  return (
    <section className="rounded-lg border border-line bg-panel p-6">
      <h2 className="font-display text-base font-medium text-ink">
        Ke mana kopimu pergi
      </h2>
      <p className="mt-1 font-body text-xs text-ink-faint">
        Sepanjang waktu -- persentase dihitung dari total yang keluar, bukan dari yang masuk.
      </p>
      <div className="mt-6 space-y-4">
        {rows.map((r) => {
          const pct = max > 0 ? (r.grams / max) * 100 : 0;
          const share = total > 0 ? (r.grams / total) * 100 : 0;
          return (
            <BarRow key={r.reason} label={REASON_LABELS[r.reason] ?? r.reason}
              percent={pct} value={`${formatGrams(r.grams)} · ${share.toFixed(0)}%`} />
          );
        })}
      </div>
    </section>
  );
}
