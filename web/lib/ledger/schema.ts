import { pgTable, index, foreignKey, serial, integer, timestamp, numeric, varchar, date, pgEnum, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const txnkind = pgEnum("txnkind", ['IN', 'OUT'])
export const txnreason = pgEnum("txnreason", ['ACQUIRE', 'BREW', 'GIFT', 'ADJUST'])


export const transaction = pgTable("transaction", {
	id: serial().primaryKey().notNull(),
	lotId: integer("lot_id").notNull(),
	ts: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	kind: txnkind().notNull(),
	reason: txnreason().notNull(),
	grams: numeric({ mode: "number" }).notNull(),
	note: varchar(),
}, (table) => [
	check("transaction_grams_positive_finite", sql`${table.grams} > 0 AND ${table.grams} < 'Infinity'::numeric`),
	check("transaction_kind_reason", sql`(${table.reason} = 'ACQUIRE' AND ${table.kind} = 'IN') OR (${table.reason} IN ('BREW', 'GIFT') AND ${table.kind} = 'OUT') OR ${table.reason} = 'ADJUST'`),
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
	processMethod: varchar("process_method"),
	roastDate: date("roast_date").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	notes: varchar(),
});
