from datetime import date

from coffee_ledger.repository import LedgerRepository, init_db, make_engine
from coffee_ledger.service import LedgerService


def test_data_persists_across_reconnect(tmp_path):
    """Tulis ke file SQLite, buka ulang dengan koneksi baru → data tetap ada."""
    url = f"sqlite:///{tmp_path / 'coffee.db'}"

    # tulis lewat satu service
    svc = LedgerService(LedgerRepository(make_engine(url)))
    init_db(svc.repo.engine)
    lot = svc.add_lot(name="Gayo", origin="Aceh", varietal="RB", roast_date=date(2026, 6, 20))
    svc.record_acquire(lot.id, grams=250)

    # buka ulang dengan engine + repo + service yang BARU
    svc2 = LedgerService(LedgerRepository(make_engine(url)))

    lots = svc2.list_lots()
    assert len(lots) == 1
    assert svc2.current_stock(lots[0].id) == 250


def test_postgres_engine_enables_pre_ping():
    # create_engine lazy (gak konek ke DB) → aman dites tanpa Postgres beneran.
    engine = make_engine("postgresql+psycopg2://u:p@localhost:5432/db")

    assert engine.pool._pre_ping is True
