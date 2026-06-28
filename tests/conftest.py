"""Shared pytest fixtures."""

from datetime import date

import pytest

from coffee_ledger.repository import LedgerRepository, init_db, make_engine
from coffee_ledger.service import LedgerService


@pytest.fixture
def service() -> LedgerService:
    """A LedgerService backed by a fresh in-memory SQLite database."""
    engine = make_engine("sqlite://")  # in-memory, isolated per test
    init_db(engine)
    return LedgerService(LedgerRepository(engine))


@pytest.fixture
def lot(service):
    """Satu lot contoh, udah tersimpan."""
    return service.add_lot(
        name="Gayo Bener Kelipah",
        origin="Gayo, Aceh",
        varietal="Red Bourbon",
        roast_date=date(2026, 6, 20),
    )
