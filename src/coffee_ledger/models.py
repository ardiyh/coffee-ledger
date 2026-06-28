"""Database models for the coffee ledger.

v1 melacak roasted bean. Schema sengaja simpel tapi disiapkan buat di-extend
(green bean + roasting yield) di fase berikutnya.
"""

from datetime import date, datetime
from enum import StrEnum

from sqlmodel import Field, SQLModel


class TxnKind(StrEnum):
    """Arah pergerakan stok."""

    IN = "IN"
    OUT = "OUT"


class TxnReason(StrEnum):
    """Alasan transaksi."""

    ACQUIRE = "ACQUIRE"  # masuk: beli / hasil roasting
    BREW = "BREW"        # keluar: diseduh
    GIFT = "GIFT"        # keluar: dikasih orang
    ADJUST = "ADJUST"    # koreksi timbangan (bisa IN atau OUT)


class Lot(SQLModel, table=True):
    """Satu batch kopi roasted (mis. 'Gayo Bener Kelipah', roast 20 Jun 2026)."""

    id: int | None = Field(default=None, primary_key=True)
    name: str
    origin: str
    varietal: str
    roast_date: date
    created_at: datetime = Field(default_factory=datetime.now)
    notes: str | None = None


class Transaction(SQLModel, table=True):
    """Satu pergerakan gram di buku besar (append-only)."""

    id: int | None = Field(default=None, primary_key=True)
    lot_id: int = Field(foreign_key="lot.id", index=True)
    ts: datetime = Field(default_factory=datetime.now)
    kind: TxnKind
    reason: TxnReason
    grams: float
    note: str | None = None
