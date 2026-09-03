/**
 * Two-column, text against a small equation panel, not a hero image again.
 * Varies the shape from the section before and after it.
 */
export function LedgerIdea() {
  return (
    <section className="mx-auto max-w-[1100px] px-6 py-16">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="flex flex-col gap-5">
          <h2 className="font-display text-2xl font-medium text-ink sm:text-3xl">
            Stok tidak pernah disimpan sebagai angka.
          </h2>
          <p className="font-body text-base text-ink-dim">
            Tabel Lot tidak punya kolom stok. Yang tercatat cuma transaksi:
            tiap kali kopi masuk, diseduh, dikasih ke orang, atau dikoreksi.
            Stok yang tampil di layar dihitung ulang tiap kali diminta,
            dengan menjumlahkan seluruh riwayat itu.
          </p>
          <ul className="flex flex-col gap-3 font-body text-sm text-ink-dim">
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
              <span>Stok tidak bisa diam-diam berbeda dari riwayatnya.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
              <span>Jejak auditnya otomatis ikut, tanpa kerja tambahan.</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
              <span>
                Membatalkan sesuatu berarti mencatat koreksi baru, bukan
                menghapus baris lama.
              </span>
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-line bg-panel-2 p-6">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            Stok, dihitung tiap kali diminta
          </p>
          <p className="mt-4 font-mono text-sm leading-relaxed text-ink">
            stok = acquire + adjust_in
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;- brew - gift - adjust_out
          </p>
        </div>
      </div>
    </section>
  );
}
