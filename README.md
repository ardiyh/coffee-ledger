# ☕ Coffee Ledger

Web app buat melacak **aliran stok biji kopi roasted** (masuk/keluar, per gram) — buat
diseduh sendiri atau dikasih orang. Sekaligus projek belajar *software engineering* &
*data science* dengan data kopi sendiri.

## Tujuan

1. **Alat nyata** — catat in/out stok kopi (gram), kebuka dari HP & laptop.
2. **Belajar** — project flow, testing, deploy, lalu EDA/forecasting dari datanya.

## Stack

- **App:** Next.js 16 · TypeScript · Tailwind v4 · Drizzle · Auth.js · Vitest + PGlite — di Vercel
- **Data:** Neon Postgres
- **Analisa:** Python 3.12 · `uv` · SQLModel (jalur baca) · pandas + Jupyter · pytest · ruff

## Arsitektur

```
UI (Next.js di Vercel)  →  web/lib/ledger/ (core TypeScript, tested)  →  Neon Postgres
                                                                       ↑
                                     src/coffee_ledger/ (jalur baca Python buat EDA)
```

Logika inti (`src/coffee_ledger/`) dipisah & dites; UI cuma lapisan tipis di atasnya.

## Kepemilikan schema

Sejak Streamlit pensiun, **Drizzle yang memiliki schema**. Perubahan kolom lewat
`drizzle-kit generate` + `drizzle-kit migrate` dari dalam `web/`.

`src/coffee_ledger/` dipertahankan sebagai jalur baca Python untuk analisa (pandas,
notebook). Model SQLModel-nya bisa tertinggal dari schema kalau Drizzle menambah kolom;
untuk membaca kolom lama itu tidak masalah, dan itu satu-satunya yang dibutuhkan EDA.
Jangan menjalankan `SQLModel.metadata.create_all()` terhadap database produksi lagi.

## Struktur

```
web/                 # app Next.js (UI + core TypeScript + test)
  lib/ledger/        # core: schema, repository, service
  app/(app)/         # halaman di balik login
src/coffee_ledger/   # jalur baca Python buat analisa
tests/               # pytest
notebooks/           # analisa (pandas)
data/                # SQLite lokal buat eksperimen (gak di-commit)
```

## Cara jalanin (dev)

```bash
# app (Next.js)
cd web && npm install
npm run dev                        # http://localhost:3000
npm test                           # 14 test, pakai PGlite, gak butuh DATABASE_URL

# sisi Python (analisa)
uv sync
uv run pytest
uv run ruff check
```

## Roadmap

- [x] **Fase 0** — Setup projek (uv, struktur, git, ruff+pytest)
- [x] **Fase 1** — Core domain + test (TDD)
- [x] **Fase 2** — Streamlit UI
- [x] **Fase 3** — Deploy (Streamlit Cloud + Postgres)
- [x] **Fase 4** — Pindah ke Next.js + Vercel; Streamlit pensiun
- [ ] **Fase 5** — Analisa (EDA)

## Learning log

Catatan hal baru yang dipelajari tiap fase:

- **Fase 0** — `uv` buat manage project & deps; *src-layout*; kenapa core dipisah dari UI;
  git + `.gitignore`; config `ruff` & `pytest` di `pyproject.toml`.
- **Fase 1** — **TDD** (RED→GREEN→REFACTOR); pola *ledger* (stok dihitung dari transaksi,
  bukan disimpan); pisah `repository` (data) vs `service` (aturan bisnis); pytest *fixtures*
  (`conftest.py`) buat hapus duplikasi; custom *exceptions*; `enum.StrEnum`; round-trip
  persistence test; feature branch + merge. 15 test hijau.
- **Fase 2** — Streamlit UI sebagai *lapisan tipis* di atas service; `st.cache_resource`
  (service dibikin sekali); `st.tabs`/form; `LedgerError` → pesan UI; **AppTest** (uji UI
  headless); tema dark via `.streamlit/config.toml` + chart Altair; `note` ditambah ke core
  lewat TDD (bikin UI nyingkap kebutuhan core). 17 test hijau.
