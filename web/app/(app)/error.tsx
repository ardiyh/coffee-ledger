"use client";

export default function AppError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-line bg-panel p-6">
      <h2 className="font-display text-lg font-medium text-ink">Catatan belum bisa dimuat.</h2>
      <p className="mt-2 font-body text-sm text-ink-dim">
        Muat ulang data. Jika tadi sedang menyimpan, periksa riwayat sebelum mencatat lagi.
      </p>
      <button type="button" onClick={() => retry()}
        className="mt-4 rounded-full bg-amber px-5 py-2 font-body text-sm font-semibold text-ground">
        Muat ulang data
      </button>
    </div>
  );
}
