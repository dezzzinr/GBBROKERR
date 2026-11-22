import dotenv from "dotenv";
import pg from "pg";
import { readFile } from "node:fs/promises";

dotenv.config({ path: ".env.local" });
dotenv.config();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required; choose the intended database before running this migration.");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(await readFile(new URL("../migrations/20261121_eight_bot_plan_tiers.sql", import.meta.url), "utf8"));
  console.log("Eight bot plan tiers applied.");
} finally {
  await client.end();
}
