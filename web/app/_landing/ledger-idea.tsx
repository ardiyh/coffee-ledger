import { Reveal } from "./reveal";

/**
 * Full width and centred, not another text-left-box-right split. The
 * statement and the formula are the point of this section, so they get the
 * whole column to breathe in instead of squeezing into half of it; the
 * three bullets sit below as a row, not stacked beside the prose.
 */
export function LedgerIdea() {
  return (
    <section className="mx-auto max-w-[1100px] px-6 py-24 sm:py-32">
      <div className="mx-auto flex max-w-[680px] flex-col items-center gap-6 text-center">
        <Reveal>
          <h2 className="font-display text-2xl font-medium text-ink sm:text-3xl">
            Stok tidak pernah disimpan sebagai angka.
          </h2>
        </Reveal>
        <Reveal delayMs={80}>
          <p className="font-body text-base text-ink-dim">
            Tabel Lot tidak punya kolom stok. Yang tercatat cuma transaksi:
            tiap kali kopi masuk, diseduh, dikasih ke orang, atau dikoreksi.
            Stok yang tampil di layar dihitung ulang tiap kali diminta,
            dengan menjumlahkan seluruh riwayat itu.
          </p>
        </Reveal>
        <Reveal
          delayMs={160}
          className="mt-4 w-full rounded-lg border border-line bg-panel-2 p-8 sm:p-10"
        >
          <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            Stok, dihitung tiap kali diminta
          </p>
          <p className="mt-4 font-mono text-base leading-relaxed text-ink sm:text-lg">
            stok = acquire + adjust_in
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;- brew - gift - adjust_out
          </p>
        </Reveal>
      </div>

      <ul className="mx-auto mt-16 grid max-w-[900px] grid-cols-1 gap-10 sm:grid-cols-3">
        <li>
          <Reveal
            delayMs={240}
            className="flex flex-col items-center gap-3 text-center"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber" />
            <span className="font-body text-sm text-ink-dim">
              Stok tidak bisa diam-diam berbeda dari riwayatnya.
            </span>
          </Reveal>
        </li>
        <li>
          <Reveal
            delayMs={320}
            className="flex flex-col items-center gap-3 text-center"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber" />
            <span className="font-body text-sm text-ink-dim">
              Jejak auditnya otomatis ikut, tanpa kerja tambahan.
            </span>
          </Reveal>
        </li>
        <li>
          <Reveal
            delayMs={400}
            className="flex flex-col items-center gap-3 text-center"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber" />
            <span className="font-body text-sm text-ink-dim">
              Membatalkan sesuatu berarti mencatat koreksi baru, bukan
              menghapus baris lama.
            </span>
          </Reveal>
        </li>
      </ul>
    </section>
  );
}
