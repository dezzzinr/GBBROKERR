import dotenv from "dotenv";
import pg from "pg";
import { readFile } from "node:fs/promises";
dotenv.config({ path: ".env.local" }); dotenv.config();
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is required"); process.exit(1); }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try { await pool.query(await readFile(new URL("../migrations/20261124_password_reset_fields.sql", import.meta.url), "utf8")); console.log("Password reset migration applied."); }
catch (error) { console.error("Migration failed:", error.message); process.exitCode = 1; }
finally { await pool.end(); }
