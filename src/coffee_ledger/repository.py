"""Persistence layer: bikin engine, init schema, dan akses data mentah (CRUD).

Layer ini cuma tahu cara *menyimpan & mengambil* data. Aturan bisnis (hitung stok,
validasi) ada di service.py.
"""

import os
import time
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from coffee_ledger.models import Lot, Transaction

DEFAULT_URL = "sqlite:///data/coffee.db"
_IN_MEMORY = {"sqlite://", "sqlite:///:memory:"}


def make_engine(url: str | None = None):
    """Bikin SQLModel engine dari URL (arg → env DATABASE_URL → default SQLite file)."""
    url = url or os.environ.get("DATABASE_URL") or DEFAULT_URL
    connect_args: dict = {}
    kwargs: dict = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        if url in _IN_MEMORY:
            # satu koneksi dipakai bareng → DB in-memory gak hilang antar-session
            kwargs["poolclass"] = StaticPool
        else:
            # pastikan folder buat file .db ada
            db_path = url.split("sqlite:///", 1)[-1]
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    else:
        # Server DB (Postgres/Neon): Neon nutup koneksi idle & auto-suspend, jadi koneksi di
        # pool bisa mati → OperationalError pas pertama buka. pre_ping ngecek + reconnect
        # otomatis; recycle buang koneksi >5 menit sebelum di-drop server.
        kwargs["pool_pre_ping"] = True
        kwargs["pool_recycle"] = 300
    return create_engine(url, connect_args=connect_args, **kwargs)


def init_db(engine) -> None:
    """Bikin semua tabel dari model SQLModel (kalau belum ada)."""
    SQLModel.metadata.create_all(engine)


def wait_for_db(engine, attempts: int = 6, delay: float = 2.0) -> None:
    """Ping DB berulang sampai konek — ride-out cold-start Neon (auto-suspend)."""
    for i in range(attempts):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except OperationalError:
            if i == attempts - 1:
                raise
            time.sleep(delay)


class LedgerRepository:
    """Akses data untuk Lot & Transaction. Buka session per operasi."""

    def __init__(self, engine):
        self.engine = engine

    def add_lot(self, lot: Lot) -> Lot:
        with Session(self.engine) as session:
            session.add(lot)
            session.commit()
            session.refresh(lot)
            return lot

    def get_lot(self, lot_id: int) -> Lot | None:
        with Session(self.engine) as session:
            return session.get(Lot, lot_id)

    def list_lots(self) -> list[Lot]:
        with Session(self.engine) as session:
            return list(session.exec(select(Lot)).all())

    def add_transaction(self, txn: Transaction) -> Transaction:
        with Session(self.engine) as session:
            session.add(txn)
            session.commit()
            session.refresh(txn)
            return txn

    def transactions_for(self, lot_id: int) -> list[Transaction]:
        with Session(self.engine) as session:
            stmt = (
                select(Transaction)
                .where(Transaction.lot_id == lot_id)
                .order_by(Transaction.ts, Transaction.id)
            )
            return list(session.exec(stmt).all())

    def all_transactions(self) -> list[Transaction]:
        with Session(self.engine) as session:
            stmt = select(Transaction).order_by(Transaction.ts, Transaction.id)
            return list(session.exec(stmt).all())
