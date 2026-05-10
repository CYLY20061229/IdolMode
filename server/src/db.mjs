import { closePool as closeSharedPool, getPool } from "./db/pool.mjs";

export { getPool };

export function isDbEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

export async function query(text, params = []) {
  const result = await getPool().query(text, params);
  return result;
}

export async function transaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await closeSharedPool();
}
