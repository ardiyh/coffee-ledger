def test_add_lot_then_it_appears_in_list(service, lot):
    assert lot.id is not None
    lots = service.list_lots()
    assert len(lots) == 1
    assert lots[0].name == "Gayo Bener Kelipah"
    assert lots[0].varietal == "Red Bourbon"


def test_acquire_increases_stock(service, lot):
    service.record_acquire(lot.id, grams=250)

    assert service.current_stock(lot.id) == 250


def test_brew_decreases_stock(service, lot):
    service.record_acquire(lot.id, grams=250)

    service.record_brew(lot.id, grams=18)

    assert service.current_stock(lot.id) == 232


def test_gift_decreases_stock(service, lot):
    service.record_acquire(lot.id, grams=250)

    service.record_gift(lot.id, grams=50)

    assert service.current_stock(lot.id) == 200


def test_stock_is_net_of_all_transactions(service, lot):
    service.record_acquire(lot.id, grams=250)
    service.record_acquire(lot.id, grams=100)
    service.record_brew(lot.id, grams=18)
    service.record_gift(lot.id, grams=30)

    assert service.current_stock(lot.id) == 302


def test_note_is_saved_on_transaction(service, lot):
    service.record_acquire(lot.id, grams=100, note="beli dari roastery")
    service.record_brew(lot.id, grams=18, note="V60")

    notes = [t.note for t in service.history(lot.id)]
    assert notes == ["beli dari roastery", "V60"]
