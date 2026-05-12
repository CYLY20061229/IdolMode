import crypto from "node:crypto";
import { query } from "./db.mjs";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return `idm_${crypto.randomBytes(32).toString("base64url")}`;
}

export function getBearerToken(req) {
  const authorization = req.headers.authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export async function createDeviceSession({ userId, deviceId, platform }) {
  const sessionToken = createSessionToken();
  const tokenHash = hashToken(sessionToken);
  const result = await query(
    `INSERT INTO device_sessions (user_id, token_hash, device_id, platform, expires_at)
     VALUES ($1, $2, $3, $4, now() + interval '180 days')
     RETURNING id, user_id, device_id, platform, created_at, last_used_at, expires_at`,
    [userId, tokenHash, deviceId || null, platform || null]
  );

  return {
    sessionToken,
    session: result.rows[0]
  };
}

export async function getSessionUserId(sessionToken) {
  if (!sessionToken) return "";
  const tokenHash = hashToken(sessionToken);
  const result = await query(
    `UPDATE device_sessions SET last_used_at = now()
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
     RETURNING user_id`,
    [tokenHash]
  );
  return result.rows[0]?.user_id || "";
}

export async function revokeSession(sessionToken) {
  if (!sessionToken) return false;
  const tokenHash = hashToken(sessionToken);
  const result = await query(
    `UPDATE device_sessions SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL
     RETURNING id`,
    [tokenHash]
  );
  return result.rowCount > 0;
}

export async function resolveUserId(req, body = {}) {
  const sessionUserId = await getSessionUserId(getBearerToken(req));
  if (sessionUserId) return sessionUserId;

  if (process.env.ALLOW_INSECURE_USER_ID_HEADER === "false") {
    return "";
  }

  return body.userId || req.headers["x-user-id"] || "";
}
