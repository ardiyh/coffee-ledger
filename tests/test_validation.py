import pytest

from coffee_ledger.errors import (
    InsufficientStockError,
    InvalidQuantityError,
    LotNotFoundError,
)
from coffee_ledger.models import TxnKind


def test_cannot_brew_more_than_stock(service, lot):
    service.record_acquire(lot.id, grams=100)

    with pytest.raises(InsufficientStockError):
        service.record_brew(lot.id, grams=150)

    assert service.current_stock(lot.id) == 100  # stok gak boleh berubah


def test_cannot_gift_more_than_stock(service, lot):
    service.record_acquire(lot.id, grams=50)

    with pytest.raises(InsufficientStockError):
        service.record_gift(lot.id, grams=60)


def test_grams_must_be_positive(service, lot):
    with pytest.raises(InvalidQuantityError):
        service.record_acquire(lot.id, grams=0)

    with pytest.raises(InvalidQuantityError):
        service.record_acquire(lot.id, grams=-5)


def test_recording_for_unknown_lot_raises(service):
    with pytest.raises(LotNotFoundError):
        service.record_acquire(999, grams=10)


def test_adjust_can_increase_and_decrease_stock(service, lot):
    service.record_acquire(lot.id, grams=100)

    service.record_adjust(lot.id, grams=5, kind=TxnKind.OUT)  # tumpah 5g
    assert service.current_stock(lot.id) == 95

    service.record_adjust(lot.id, grams=3, kind=TxnKind.IN)  # kalibrasi +3
    assert service.current_stock(lot.id) == 98
