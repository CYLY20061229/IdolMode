import pg from "pg";

const { Pool } = pg;

let realPool;

function sslConfig() {
  const value = String(process.env.DB_SSL || "false").toLowerCase();
  if (value !== "true") return undefined;
  return { rejectUnauthorized: false };
}

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for PostgreSQL connection pool.");
  }

  if (!realPool) {
    realPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX || 10),
      ssl: sslConfig()
    });
  }

  return realPool;
}

export const pool = new Proxy(
  {},
  {
    get(_target, property) {
      const value = getPool()[property];
      return typeof value === "function" ? value.bind(getPool()) : value;
    }
  }
);

export async function closePool() {
  if (!realPool) return;
  await realPool.end();
  realPool = undefined;
}
