export interface LotSuggestions {
  origins: string[];
  varietals: string[];
  processMethods: string[];
}

/**
 * Source of truth for both LotRow's "Aksi" select options and, in LotList,
 * the human verb shown in the receipt banner -- so the two can't drift apart
 * into two different names for the same action. Lives here, not in either
 * component, since it's shared vocabulary neither one owns.
 */
export const ACTION_OPTIONS = [
  { value: "ACQUIRE", label: "Masuk / beli" },
  { value: "BREW", label: "Seduh" },
  { value: "GIFT", label: "Kasih orang" },
  { value: "ADJUST_IN", label: "Koreksi naik" },
  { value: "ADJUST_OUT", label: "Koreksi turun" },
] as const;

export type RecordActionValue = (typeof ACTION_OPTIONS)[number]["value"];

export const ACTION_LABELS = Object.fromEntries(
  ACTION_OPTIONS.map((opt) => [opt.value, opt.label]),
) as Record<RecordActionValue, string>;
