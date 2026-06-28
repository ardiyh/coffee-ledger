# ☕ Coffee Ledger

Web app buat melacak **aliran stok biji kopi roasted** (masuk/keluar, per gram) — buat
diseduh sendiri atau dikasih orang. Sekaligus projek belajar *software engineering* &
*data science* dengan data kopi sendiri.

## Tujuan

1. **Alat nyata** — catat in/out stok kopi (gram), kebuka dari HP & laptop.
2. **Belajar** — project flow, testing, deploy, lalu EDA/forecasting dari datanya.

## Stack

- Python 3.12 · `uv` · `SQLModel` (SQLite → Postgres) · Streamlit · pytest · ruff
- Analisa: pandas + Jupyter

## Arsitektur

```
UI (Streamlit)  →  coffee_ledger/ (core, tested)  →  SQLite / Postgres
                                                   →  notebooks/ (pandas EDA)
```

Logika inti (`src/coffee_ledger/`) dipisah & dites; UI cuma lapisan tipis di atasnya.

## Struktur

```
src/coffee_ledger/   # core: models, repository, service
app/                 # Streamlit UI
tests/               # pytest
notebooks/           # analisa (pandas)
data/                # SQLite db (lokal, gak di-commit)
```

## Cara jalanin (dev)

```bash
uv sync                            # pasang semua deps
uv run pytest                      # jalanin test
uv run ruff check                  # lint
uv run streamlit run app/app.py    # jalanin app (mulai Fase 2)
```

## Roadmap

- [x] **Fase 0** — Setup projek (uv, struktur, git, ruff+pytest)
- [x] **Fase 1** — Core domain + test (TDD)
- [ ] **Fase 2** — Streamlit UI
- [ ] **Fase 3** — Deploy (Streamlit Cloud + Postgres)
- [ ] **Fase 4** — Analisa (EDA)

## Learning log

Catatan hal baru yang dipelajari tiap fase:

- **Fase 0** — `uv` buat manage project & deps; *src-layout*; kenapa core dipisah dari UI;
  git + `.gitignore`; config `ruff` & `pytest` di `pyproject.toml`.
- **Fase 1** — **TDD** (RED→GREEN→REFACTOR); pola *ledger* (stok dihitung dari transaksi,
  bukan disimpan); pisah `repository` (data) vs `service` (aturan bisnis); pytest *fixtures*
  (`conftest.py`) buat hapus duplikasi; custom *exceptions*; `enum.StrEnum`; round-trip
  persistence test; feature branch + merge. 15 test hijau.
