import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { db } from "@/lib/db";
import { history, listLots } from "@/lib/ledger/service";
import { formatWIB } from "@/lib/format";

function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  // Real auth boundary for this endpoint — a Route Handler is a real HTTP
  // endpoint reachable directly, same reasoning as Server Actions. See
  // lib/session.ts.
  await requireSession();

  const [txns, lots] = await Promise.all([history(db), listLots(db)]);
  const lotNames = new Map(lots.map((l) => [l.id, l.name]));
  const sorted = [...txns].sort((a, b) => b.ts.getTime() - a.ts.getTime());

  const header = ["waktu_wib", "lot", "arah", "alasan", "gram", "catatan"];
  const rows = sorted.map((t) => {
    const signedGrams = t.kind === "IN" ? t.grams : -t.grams;
    return [
      formatWIB(t.ts),
      lotNames.get(t.lotId) ?? `Lot ${t.lotId}`,
      t.kind,
      t.reason,
      String(signedGrams),
      t.note ?? "",
    ]
      .map(csvField)
      .join(",");
  });

  const csv = [header.join(","), ...rows].join("\n") + "\n";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="coffee-ledger-history.csv"',
    },
  });
}
