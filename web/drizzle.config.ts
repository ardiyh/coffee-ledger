import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Default to next dev's environment; production migrations must opt in explicitly.
loadEnvConfig(__dirname, process.env.NODE_ENV !== "production");

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/ledger/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
