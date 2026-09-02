import { relations } from "drizzle-orm/relations";
import { lot, transaction } from "./schema";

export const transactionRelations = relations(transaction, ({one}) => ({
	lot: one(lot, {
		fields: [transaction.lotId],
		references: [lot.id]
	}),
}));

export const lotRelations = relations(lot, ({many}) => ({
	transactions: many(transaction),
}));