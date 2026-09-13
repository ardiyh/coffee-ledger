from datetime import date

import pytest

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


def test_postgres_engine_is_read_only_for_analysis():
    engine = make_engine("postgresql+psycopg2://u:p@localhost:5432/db")
    assert engine.get_execution_options().get("postgresql_readonly") is True


def test_init_db_refuses_postgres_without_connecting(monkeypatch):
    engine = make_engine("postgresql+psycopg2://u:p@localhost:5432/db")

    def unexpected_connection(*args, **kwargs):
        pytest.fail("init_db must reject PostgreSQL before connecting")

    monkeypatch.setattr(engine, "connect", unexpected_connection)
    with pytest.raises(ValueError, match="Drizzle"):
        init_db(engine)


def test_wait_for_db_returns_on_working_engine():
    from coffee_ledger.repository import wait_for_db

    wait_for_db(make_engine("sqlite://"))  # engine sehat → langsung balik, gak raise
