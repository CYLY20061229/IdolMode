import { createHmac, randomUUID } from "node:crypto";

const allowedKinds = new Set(["avatar", "chat-image", "sticker", "profile-background", "voice"]);
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/webm",
  "audio/aac",
  "audio/x-m4a"
]);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for OSS uploads.`);
  return value;
}

function normalizeEndpoint(endpoint) {
  return String(endpoint || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function extensionForMime(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "audio/webm") return "webm";
  if (mimeType === "audio/mpeg" || mimeType === "audio/mp3") return "mp3";
  if (mimeType === "audio/wav") return "wav";
  if (mimeType === "audio/aac") return "aac";
  if (mimeType === "audio/m4a" || mimeType === "audio/mp4" || mimeType === "audio/x-m4a") return "m4a";
  return "jpg";
}

function normalizeKind(kind) {
  return allowedKinds.has(kind) ? kind : "chat-image";
}

export function createOssPutSignature({ userId, kind, mimeType }) {
  const accessKeyId = required("OSS_ACCESS_KEY_ID");
  const accessKeySecret = required("OSS_ACCESS_KEY_SECRET");
  const bucket = required("OSS_BUCKET");
  const endpoint = normalizeEndpoint(required("OSS_ENDPOINT"));
  const publicBaseUrl = (process.env.OSS_PUBLIC_BASE_URL || `https://${bucket}.${endpoint}`).replace(/\/$/, "");
  const fallbackMimeType = kind === "voice" ? "audio/m4a" : "image/jpeg";
  const normalizedMimeType = allowedMimeTypes.has(mimeType) ? mimeType : fallbackMimeType;
  const normalizedKind = normalizeKind(kind);
  const expires = Math.floor(Date.now() / 1000) + Number(process.env.OSS_SIGN_EXPIRES_SECONDS || 600);
  const ext = extensionForMime(normalizedMimeType);
  const safeUserId = String(userId || "anonymous").replace(/[^a-zA-Z0-9_-]/g, "");
  const objectKey = `uploads/${safeUserId}/${normalizedKind}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${randomUUID()}.${ext}`;

  const canonicalizedResource = `/${bucket}/${objectKey}`;
  const stringToSign = ["PUT", "", normalizedMimeType, String(expires), canonicalizedResource].join("\n");
  const signature = createHmac("sha1", accessKeySecret).update(stringToSign).digest("base64");
  const query = new URLSearchParams({
    OSSAccessKeyId: accessKeyId,
    Expires: String(expires),
    Signature: signature
  });

  return {
    uploadUrl: `https://${bucket}.${endpoint}/${objectKey}?${query.toString()}`,
    publicUrl: `${publicBaseUrl}/${objectKey}`,
    objectKey,
    method: "PUT",
    headers: {
      "Content-Type": normalizedMimeType
    },
    expires
  };
}
