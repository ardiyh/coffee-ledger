CREATE TYPE "public"."txnkind" AS ENUM('IN', 'OUT');--> statement-breakpoint
CREATE TYPE "public"."txnreason" AS ENUM('ACQUIRE', 'BREW', 'GIFT', 'ADJUST');--> statement-breakpoint
CREATE TABLE "lot" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"origin" varchar NOT NULL,
	"varietal" varchar NOT NULL,
	"process_method" varchar,
	"roast_date" date NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"notes" varchar
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" serial PRIMARY KEY NOT NULL,
	"lot_id" integer NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"kind" "txnkind" NOT NULL,
	"reason" "txnreason" NOT NULL,
	"grams" double precision NOT NULL,
	"note" varchar
);
--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_transaction_lot_id" ON "transaction" USING btree ("lot_id" int4_ops);