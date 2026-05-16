import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { query } from "./db.mjs";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return `idm_${crypto.randomBytes(32).toString("base64url")}`;
}

function jwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required for email authentication.");
  }
  return process.env.JWT_SECRET;
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

export function createJwtToken(userId) {
  return jwt.sign(
    {
      sub: String(userId),
      typ: "access"
    },
    jwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "180d",
      issuer: process.env.JWT_ISSUER || "idol-mode-api"
    }
  );
}

export function verifyJwtUserId(token) {
  if (!token || token.startsWith("idm_")) return "";
  try {
    const payload = jwt.verify(token, jwtSecret(), {
      issuer: process.env.JWT_ISSUER || "idol-mode-api"
    });
    return typeof payload?.sub === "string" ? payload.sub : "";
  } catch {
    return "";
  }
}

export async function revokeAllDeviceSessionsForUser(userId) {
  if (!userId) return 0;
  const result = await query(
    `UPDATE device_sessions SET revoked_at = now()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  return result.rowCount;
}

export async function resolveUserId(req, body = {}) {
  const bearerToken = getBearerToken(req);
  const jwtUserId = verifyJwtUserId(bearerToken);
  if (jwtUserId) return jwtUserId;

  const sessionUserId = await getSessionUserId(bearerToken);
  if (sessionUserId) return sessionUserId;

  if (process.env.ALLOW_INSECURE_USER_ID_HEADER === "false") {
    return "";
  }

  return body.userId || req.headers["x-user-id"] || "";
}
