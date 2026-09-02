/** Domain errors untuk coffee ledger. */

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Lot yang diminta gak ada. */
export class LotNotFoundError extends LedgerError {
  constructor(message: string) {
    super(message);
    this.name = "LotNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Gram harus angka positif. */
export class InvalidQuantityError extends LedgerError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQuantityError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Mau ngeluarin lebih banyak dari stok yang tersedia. */
export class InsufficientStockError extends LedgerError {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientStockError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
