import crypto from "node:crypto";

function requiredSecret(name, fallbackNames = []) {
  const value = process.env[name] || fallbackNames.map((key) => process.env[key]).find(Boolean);
  if (!value) {
    throw new Error(`${name} is required for email authentication.`);
  }
  return value;
}

function hmacHex(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function encryptionKey() {
  const raw = requiredSecret("EMAIL_ENCRYPTION_KEY", ["JWT_SECRET"]);
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // fall through to derived key
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("邮箱格式不正确。");
  }
  return value;
}

export function maskEmail(normalizedEmail) {
  const [name, domain] = String(normalizedEmail || "").split("@");
  if (!name || !domain) return "";
  const first = name.slice(0, 1);
  return `${first}${name.length > 1 ? "***" : "*"}@${domain}`;
}

export function hashEmail(normalizedEmail) {
  return hmacHex(requiredSecret("EMAIL_HASH_SECRET", ["JWT_SECRET"]), normalizedEmail);
}

export function hashIp(ip) {
  return hmacHex(requiredSecret("EMAIL_HASH_SECRET", ["JWT_SECRET"]), String(ip || "unknown"));
}

export function hashEmailCode({ normalizedEmail, code, purpose }) {
  return hmacHex(requiredSecret("EMAIL_CODE_SECRET", ["JWT_SECRET"]), `${normalizedEmail}:${purpose}:${code}`);
}

export function encryptEmail(normalizedEmail) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalizedEmail, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptEmail(emailEncrypted) {
  if (!emailEncrypted) return "";
  const [ivRaw, tagRaw, encryptedRaw] = String(emailEncrypted).split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) return "";
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function generateEmailCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}
