import type { ReactNode } from "react";

/** Labels wrap above the bar on phones; values always have their own column. */
export function BarRow({ label, value, percent }: {
  label: ReactNode;
  value: string;
  percent: number;
}) {
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center sm:gap-6">
      <div className="min-w-0 font-body text-sm text-ink [overflow-wrap:anywhere]">
        {label}
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_max-content] items-center gap-3">
        <div className="min-w-0" aria-hidden="true">
          <div className="h-2 rounded-r-[4px] bg-amber" style={{ width: `${percent}%` }} />
        </div>
        <span className="font-mono text-sm tabular-nums text-ink-dim">{value}</span>
      </div>
    </div>
  );
}
