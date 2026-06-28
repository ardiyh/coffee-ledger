"""Domain errors untuk coffee ledger."""


class LedgerError(Exception):
    """Base buat semua error domain."""


class LotNotFoundError(LedgerError):
    """Lot yang diminta gak ada."""


class InvalidQuantityError(LedgerError):
    """Gram harus angka positif."""


class InsufficientStockError(LedgerError):
    """Mau ngeluarin lebih banyak dari stok yang tersedia."""
