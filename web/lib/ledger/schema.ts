import { pgTable, index, foreignKey, serial, integer, timestamp, doublePrecision, varchar, date, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const txnkind = pgEnum("txnkind", ['IN', 'OUT'])
export const txnreason = pgEnum("txnreason", ['ACQUIRE', 'BREW', 'GIFT', 'ADJUST'])


export const transaction = pgTable("transaction", {
	id: serial().primaryKey().notNull(),
	lotId: integer("lot_id").notNull(),
	ts: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	kind: txnkind().notNull(),
	reason: txnreason().notNull(),
	grams: doublePrecision().notNull(),
	note: varchar(),
}, (table) => [
	index("ix_transaction_lot_id").using("btree", table.lotId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.lotId],
			foreignColumns: [lot.id],
			name: "transaction_lot_id_fkey"
		}),
]);

export const lot = pgTable("lot", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	origin: varchar().notNull(),
	varietal: varchar().notNull(),
	roastDate: date("roast_date").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	notes: varchar(),
});
