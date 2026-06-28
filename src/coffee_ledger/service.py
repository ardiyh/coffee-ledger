"""Business logic layer: aturan main inventory kopi.

Service yang tahu *aturan*: gimana nambah lot, hitung stok, dan validasi.
Dia minta tolong repository buat urusan simpan/ambil data.
"""

from datetime import date

from coffee_ledger.errors import (
    InsufficientStockError,
    InvalidQuantityError,
    LotNotFoundError,
)
from coffee_ledger.models import Lot, Transaction, TxnKind, TxnReason
from coffee_ledger.repository import LedgerRepository


class LedgerService:
    def __init__(self, repo: LedgerRepository):
        self.repo = repo

    def add_lot(
        self,
        name: str,
        origin: str,
        varietal: str,
        roast_date: date,
        notes: str | None = None,
    ) -> Lot:
        lot = Lot(
            name=name,
            origin=origin,
            varietal=varietal,
            roast_date=roast_date,
            notes=notes,
        )
        return self.repo.add_lot(lot)

    def list_lots(self) -> list[Lot]:
        return self.repo.list_lots()

    def record_acquire(
        self, lot_id: int, grams: float, note: str | None = None
    ) -> Transaction:
        return self._record(lot_id, grams, TxnKind.IN, TxnReason.ACQUIRE, note)

    def record_brew(
        self, lot_id: int, grams: float, note: str | None = None
    ) -> Transaction:
        return self._record(lot_id, grams, TxnKind.OUT, TxnReason.BREW, note)

    def record_gift(
        self, lot_id: int, grams: float, note: str | None = None
    ) -> Transaction:
        return self._record(lot_id, grams, TxnKind.OUT, TxnReason.GIFT, note)

    def record_adjust(
        self, lot_id: int, grams: float, kind: TxnKind, note: str | None = None
    ) -> Transaction:
        """Koreksi stok manual (mis. tumpah → OUT, kalibrasi naik → IN)."""
        return self._record(lot_id, grams, kind, TxnReason.ADJUST, note)

    def _record(
        self,
        lot_id: int,
        grams: float,
        kind: TxnKind,
        reason: TxnReason,
        note: str | None = None,
    ) -> Transaction:
        if grams <= 0:
            raise InvalidQuantityError(f"grams harus > 0, dapat {grams}")
        if self.repo.get_lot(lot_id) is None:
            raise LotNotFoundError(f"Lot id={lot_id} gak ditemukan")
        if kind == TxnKind.OUT:
            stock = self.current_stock(lot_id)
            if grams > stock:
                raise InsufficientStockError(
                    f"Stok lot {lot_id} cuma {stock}g, gak bisa keluarin {grams}g"
                )
        txn = Transaction(
            lot_id=lot_id, kind=kind, reason=reason, grams=grams, note=note
        )
        return self.repo.add_transaction(txn)

    def current_stock(self, lot_id: int) -> float:
        total = 0.0
        for t in self.repo.transactions_for(lot_id):
            total += t.grams if t.kind == TxnKind.IN else -t.grams
        return total

    def history(self, lot_id: int | None = None) -> list[Transaction]:
        """Daftar transaksi (semua lot kalau lot_id None), urut kronologis."""
        if lot_id is None:
            return self.repo.all_transactions()
        return self.repo.transactions_for(lot_id)

    def stock_summary(self) -> list[tuple[Lot, float]]:
        """Tiap lot beserta stok terkininya (buat dashboard)."""
        return [(lot, self.current_stock(lot.id)) for lot in self.repo.list_lots()]
