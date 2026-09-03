/**
 * Display-layer formatting only. Timestamps are stored and passed around in
 * UTC everywhere below this (repository.ts, service.ts) — the conversion to
 * Asia/Jakarta happens here, at the last possible moment, so nothing upstream
 * has to know about timezones.
 */

const WIB_TIME_ZONE = "Asia/Jakarta";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

// Intl's localized month/comma formatting (e.g. "Sept", "en-GB" commas)
// doesn't match the exact "03 Sep 2026 00:47" shape we want, so pull the
// numeric fields out with Intl (it does the correct UTC -> WIB conversion,
// including DST-free but still-correct offset math) and assemble the string
// by hand.
const WIB_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: WIB_TIME_ZONE,
  day: "2-digit",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Format a Date (stored UTC) for display in Asia/Jakarta, e.g. "03 Sep 2026 00:47". */
export function formatWIB(date: Date): string {
  const parts = Object.fromEntries(
    WIB_PARTS_FORMATTER.formatToParts(date).map((p) => [p.type, p.value]),
  );

  const day = parts.day;
  const month = MONTHS[Number(parts.month) - 1];
  const year = parts.year;
  // hour12:false formatters can emit "24" for midnight in some ICU builds.
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const minute = parts.minute;

  return `${day} ${month} ${year} ${hour}:${minute}`;
}

/**
 * Selisih hari kalender antara sebuah tanggal roast dan hari ini, dihitung di WIB.
 *
 * `roastDate` bertipe `date` di Postgres, jadi ia string `YYYY-MM-DD` tanpa jam dan
 * tanpa timezone. Yang dibandingkan tanggal kalender, bukan durasi, supaya jam
 * berapa pun di hari yang sama menghasilkan angka yang sama.
 */
export function daysSince(roastDate: string, now: Date = new Date()): number {
  const todayWIB = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(now);

  // Date.UTC menerima bulan berbasis nol, jadi bulannya dikurangi satu.
  // Keduanya dinormalkan ke tengah malam UTC supaya yang tersisa cuma selisih hari.
  const toUTC = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };

  return Math.round((toUTC(todayWIB) - toUTC(roastDate)) / 86_400_000);
}

const GRAM_FORMATTER = new Intl.NumberFormat("id-ID");

/** Format a gram quantity for display, e.g. 1234 -> "1.234 g". */
export function formatGrams(grams: number): string {
  return `${GRAM_FORMATTER.format(grams)} g`;
}
