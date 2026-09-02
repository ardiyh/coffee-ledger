import "dotenv/config";
import path from "path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// The Next.js app lives in web/, but the shared DATABASE_URL used by both the
// Python app and this introspection step lives in the repo root .env (one
// level up). Load it explicitly so this works regardless of cwd.
loadEnv({ path: path.resolve(__dirname, "../.env") });

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/ledger/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
