ALTER TABLE "transaction" ALTER COLUMN "grams" SET DATA TYPE numeric USING "grams"::text::numeric;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_grams_positive_finite" CHECK ("transaction"."grams" > 0 AND "transaction"."grams" < 'Infinity'::numeric);--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_kind_reason" CHECK (("transaction"."reason" = 'ACQUIRE' AND "transaction"."kind" = 'IN') OR ("transaction"."reason" IN ('BREW', 'GIFT') AND "transaction"."kind" = 'OUT') OR "transaction"."reason" = 'ADJUST');--> statement-breakpoint
-- Refuse to silently inherit an invalid balance. Existing rows are never rewritten.
DO $$
BEGIN
  IF EXISTS (
    SELECT lot_id FROM "transaction" GROUP BY lot_id
    HAVING SUM(CASE WHEN kind = 'IN' THEN grams ELSE -grams END) < 0
  ) THEN
    RAISE EXCEPTION 'Correct negative lot balances before applying stock_integrity';
  END IF;
END;
$$;--> statement-breakpoint
CREATE FUNCTION check_transaction_stock() RETURNS trigger
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  stock numeric;
BEGIN
  -- Serialize writers for this lot. The unchanged update also creates a row
  -- version, so stale REPEATABLE READ writers fail rather than use an old balance.
  UPDATE lot SET created_at = created_at WHERE id = NEW.lot_id;

  IF NEW.kind = 'OUT' THEN
    SELECT COALESCE(SUM(CASE WHEN kind = 'IN' THEN grams ELSE -grams END), 0)
      INTO stock FROM "transaction" WHERE lot_id = NEW.lot_id;
    IF NEW.grams > stock THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'transaction_stock_nonnegative',
        MESSAGE = 'Insufficient stock';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER transaction_stock_guard BEFORE INSERT ON "transaction"
FOR EACH ROW EXECUTE FUNCTION check_transaction_stock();
