import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { closePool, query, transaction } from "./db.mjs";

const migrationsDir = path.resolve("migrations");

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedVersions() {
  const result = await query("SELECT version FROM schema_migrations");
  return new Set(result.rows.map((row) => row.version));
}

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }
  if (!existsSync(migrationsDir)) {
    throw new Error(`Missing migrations directory: ${migrationsDir}`);
  }

  await ensureMigrationsTable();
  const applied = await appliedVersions();
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    await transaction(async (client) => {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
    });
    console.log(`Applied migration ${file}`);
  }

  if (files.every((file) => applied.has(file))) {
    console.log("No pending migrations.");
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
