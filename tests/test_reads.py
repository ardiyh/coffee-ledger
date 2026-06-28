from datetime import date

from coffee_ledger.models import TxnReason


def _two_lots(service):
    a = service.add_lot(name="A", origin="Gayo", varietal="RB", roast_date=date(2026, 6, 1))
    b = service.add_lot(name="B", origin="Toraja", varietal="Typica", roast_date=date(2026, 6, 2))
    return a, b


def test_history_returns_transactions_in_chronological_order(service, lot):
    service.record_acquire(lot.id, grams=250)
    service.record_brew(lot.id, grams=18)

    history = service.history(lot.id)

    assert [t.reason for t in history] == [TxnReason.ACQUIRE, TxnReason.BREW]
    assert [t.grams for t in history] == [250, 18]


def test_history_without_lot_returns_all_lots(service):
    a, b = _two_lots(service)
    service.record_acquire(a.id, grams=100)
    service.record_acquire(b.id, grams=200)

    assert len(service.history()) == 2


def test_stock_summary_lists_each_lot_with_its_stock(service):
    a, b = _two_lots(service)
    service.record_acquire(a.id, grams=100)
    service.record_brew(a.id, grams=30)
    service.record_acquire(b.id, grams=200)

    summary = {lot.name: stock for lot, stock in service.stock_summary()}

    assert summary == {"A": 70, "B": 200}
