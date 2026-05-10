import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "../env.mjs";
import { closePool, pool } from "./pool.mjs";

loadEnvFiles();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "migrations");

async function ensureSchemaMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      executed_at BIGINT NOT NULL
    )
  `);
}

async function getExecutedMigrationIds() {
  const result = await pool.query("SELECT id FROM schema_migrations");
  return new Set(result.rows.map((row) => row.id));
}

async function executeMigration(fileName) {
  const filePath = path.join(migrationsDir, fileName);
  const sql = readFileSync(filePath, "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (id, executed_at) VALUES ($1, $2)",
      [fileName, Date.now()]
    );
    await client.query("COMMIT");
    console.log(`Migration executed: ${fileName}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`Migration failed: ${fileName}`);
    console.error(error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  if (!existsSync(migrationsDir)) {
    throw new Error(`Migrations directory does not exist: ${migrationsDir}`);
  }

  await ensureSchemaMigrationsTable();
  const executed = await getExecutedMigrationIds();
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  let executedCount = 0;
  for (const fileName of migrationFiles) {
    if (executed.has(fileName)) {
      console.log(`Migration skipped: ${fileName}`);
      continue;
    }

    await executeMigration(fileName);
    executedCount += 1;
  }

  console.log(`Migration complete. Executed ${executedCount} new migration(s).`);
}

main()
  .catch((error) => {
    console.error("Migration process failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
