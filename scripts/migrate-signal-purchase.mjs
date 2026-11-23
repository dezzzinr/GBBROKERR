import dotenv from "dotenv";
import pg from "pg";
import { readFile } from "node:fs/promises";
dotenv.config({ path: ".env.local" });
dotenv.config();
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is required in .env.local or .env"); process.exit(1); }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const file of ["20261122_signal_purchase.sql", "20261123_signal_requests.sql"]) {
    const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
    await pool.query(sql);
  }
  console.log("Signal purchase migration applied successfully.");
} catch (error) { console.error("Migration failed:", error.message); process.exitCode = 1; }
finally { await pool.end(); }
