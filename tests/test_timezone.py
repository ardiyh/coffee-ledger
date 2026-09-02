"""Timestamp selalu UTC timezone-aware.

Assertion-nya pada objek hasil `default_factory`, BUKAN setelah round-trip DB:
SQLite (dipakai test) membuang tzinfo walau kolomnya DateTime(timezone=True),
sementara Postgres (produksi) menyimpannya utuh. Yang dijamin di sini adalah
kode kita, bukan perilaku backend.
"""

from datetime import UTC, date, datetime, timedelta

from coffee_ledger.models import Lot, Transaction, TxnKind, TxnReason


def test_transaction_ts_is_utc_aware():
    txn = Transaction(lot_id=1, kind=TxnKind.IN, reason=TxnReason.ACQUIRE, grams=100)

    assert txn.ts.tzinfo is not None
    assert txn.ts.utcoffset() == timedelta(0)


def test_lot_created_at_is_utc_aware():
    lot = Lot(name="Gayo", origin="Aceh", varietal="RB", roast_date=date(2026, 6, 20))

    assert lot.created_at.tzinfo is not None
    assert lot.created_at.utcoffset() == timedelta(0)


def test_ts_default_is_close_to_now():
    """Jaga-jaga default_factory gak ketuker jadi konstanta."""
    txn = Transaction(lot_id=1, kind=TxnKind.IN, reason=TxnReason.ACQUIRE, grams=100)

    assert abs(txn.ts - datetime.now(UTC)) < timedelta(seconds=5)
