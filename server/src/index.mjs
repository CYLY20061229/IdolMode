import http from "node:http";
import { generateFanMessages, generateLiveFanMessage, generateLiveFanMessages, getAiConfig } from "./aiClient.mjs";
import { isDbEnabled } from "./db.mjs";
import { pool } from "./db/pool.mjs";
import { loadEnvFiles } from "./env.mjs";
import { logError, logRequest, logSlowRequest } from "./logger.mjs";
import { rateLimit } from "./rateLimit.mjs";
import {
  addArtistFriend,
  createAiGenerationJob,
  createFanMessages,
  createIdolChatMessage,
  createSelfMessage,
  finishAiGenerationJob,
  getBootstrap,
  getUserId,
  listFanMessages,
  removeArtistFriend,
  updateProfile,
  updateSelfMessageStatus,
  upsertDeviceUser
} from "./repository.mjs";

loadEnvFiles();

const port = Number(process.env.PORT || 8787);
const slowRequestMs = Number(process.env.SLOW_REQUEST_MS || 3000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

function requestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function corsHeaders(req) {
  const origin = req.headers.origin || "*";
  const allowOrigin = allowedOrigins.includes("*") || allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Request-Id",
    "Vary": "Origin"
  };
}

function sendJson(req, res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(req),
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 32_768) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function clientKey(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function sendDatabaseUnavailable(req, res, requestId) {
  sendJson(req, res, 503, {
    error: "Database is not configured.",
    requestId
  });
}

function requireDatabaseUser(req, res, requestId, body = {}) {
  if (!isDbEnabled()) {
    sendDatabaseUnavailable(req, res, requestId);
    return "";
  }

  const userId = getUserId(req, body);
  if (!userId) {
    sendJson(req, res, 401, {
      error: "Missing user id. Send X-User-Id header or userId in request body.",
      requestId
    });
    return "";
  }

  return String(userId);
}

async function recordAiJobStart({ userId, operation, sourceMessageId, requestPayload }) {
  if (!isDbEnabled() || !userId) return undefined;
  const config = getAiConfig();
  return createAiGenerationJob({
    userId,
    operation,
    provider: config.provider,
    model: config.model,
    sourceMessageId,
    requestPayload
  });
}

const server = http.createServer(async (req, res) => {
  const id = req.headers["x-request-id"] || requestId();
  const startedAt = Date.now();
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const ip = clientKey(req);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
      const aiConfig = getAiConfig();
      sendJson(req, res, 200, {
        ok: true,
        service: "idol-mode-api",
        provider: aiConfig.provider,
        model: aiConfig.model,
        database: isDbEnabled() ? "configured" : "not_configured",
        requestId: id
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health/db") {
      try {
        await pool.query("SELECT 1 AS ok");
        sendJson(req, res, 200, {
          ok: true,
          database: "postgresql",
          time: Date.now()
        });
      } catch (error) {
        sendJson(req, res, 500, {
          ok: false,
          database: "postgresql",
          error: error instanceof Error ? error.message : String(error)
        });
      }
      return;
    }

    const limited = rateLimit({
      key: ip,
      limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 90),
      windowMs: 60_000
    });

    if (!limited.allowed) {
      sendJson(req, res, 429, { error: "Too many requests.", requestId: id }, {
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(limited.resetAt)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/auth/device") {
      if (!isDbEnabled()) {
        sendDatabaseUnavailable(req, res, id);
        return;
      }

      const body = await readJson(req);
      const auth = await upsertDeviceUser({
        deviceId: body.deviceId,
        platform: body.platform
      });
      sendJson(req, res, 200, { ...auth, requestId: id });
      return;
    }

    if (req.method === "GET" && url.pathname === "/me/bootstrap") {
      const userId = requireDatabaseUser(req, res, id);
      if (!userId) return;
      const data = await getBootstrap(userId);
      sendJson(req, res, 200, { ...data, requestId: id });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/me/profile") {
      const body = await readJson(req);
      const userId = requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const profile = await updateProfile(userId, body.profile || body);
      sendJson(req, res, 200, { profile, requestId: id });
      return;
    }

    if (req.method === "POST" && url.pathname === "/me/friends") {
      const body = await readJson(req);
      const userId = requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const artist = await addArtistFriend(userId, body.artistId);
      sendJson(req, res, 200, { artist, requestId: id });
      return;
    }

    const deleteFriendMatch = url.pathname.match(/^\/me\/friends\/([^/]+)$/);
    if (req.method === "DELETE" && deleteFriendMatch) {
      const userId = requireDatabaseUser(req, res, id);
      if (!userId) return;
      await removeArtistFriend(userId, decodeURIComponent(deleteFriendMatch[1]));
      sendJson(req, res, 200, { ok: true, requestId: id });
      return;
    }

    if (req.method === "POST" && url.pathname === "/me/self-messages") {
      const body = await readJson(req);
      const userId = requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const message = await createSelfMessage(userId, body.message || body);
      sendJson(req, res, 200, { message, requestId: id });
      return;
    }

    const selfMessageMatch = url.pathname.match(/^\/me\/self-messages\/([^/]+)$/);
    if (req.method === "PATCH" && selfMessageMatch) {
      const body = await readJson(req);
      const userId = requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const message = await updateSelfMessageStatus(userId, decodeURIComponent(selfMessageMatch[1]), body.status);
      sendJson(req, res, 200, { message, requestId: id });
      return;
    }

    if (req.method === "GET" && url.pathname === "/me/fan-messages") {
      const userId = requireDatabaseUser(req, res, id);
      if (!userId) return;
      const fanMessages = await listFanMessages(userId, url.searchParams.get("limit") || 200);
      sendJson(req, res, 200, { fanMessages, requestId: id });
      return;
    }

    if (req.method === "POST" && url.pathname === "/me/fan-messages") {
      const body = await readJson(req);
      const userId = requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const fanMessages = await createFanMessages(userId, body.fanMessages || [], body.fromSelfMessageId);
      sendJson(req, res, 200, { fanMessages, requestId: id });
      return;
    }

    if (req.method === "POST" && url.pathname === "/me/idol-chat-messages") {
      const body = await readJson(req);
      const userId = requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const message = await createIdolChatMessage(userId, body.artistId, body.message || body);
      sendJson(req, res, 200, { message, requestId: id });
      return;
    }

    if (req.method === "POST" && url.pathname === "/ai/fan-messages") {
      const body = await readJson(req);
      const userId = getUserId(req, body);
      const aiStartedAt = Date.now();
      const jobId = await recordAiJobStart({
        userId,
        operation: "fan_messages",
        sourceMessageId: body.sourceMessageId,
        requestPayload: { message: body.message, count: body.count }
      });
      const fanMessages = await generateFanMessages(body.message, body.count);
      if (userId && body.persist !== false && isDbEnabled()) {
        await createFanMessages(userId, fanMessages, body.sourceMessageId);
      }
      await finishAiGenerationJob(jobId, {
        status: "completed",
        responsePayload: { count: fanMessages.length },
        durationMs: Date.now() - aiStartedAt
      });
      sendJson(req, res, 200, { fanMessages, requestId: id }, {
        "X-RateLimit-Remaining": String(limited.remaining)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/ai/live-fan-message") {
      const body = await readJson(req);
      const userId = getUserId(req, body);
      const aiStartedAt = Date.now();
      const jobId = await recordAiJobStart({
        userId,
        operation: "live_fan_message",
        sourceMessageId: body.sourceMessageId,
        requestPayload: { recentArtistMessage: body.recentArtistMessage }
      });
      const fanMessage = await generateLiveFanMessage(body.recentArtistMessage);
      if (userId && body.persist !== false && isDbEnabled()) {
        await createFanMessages(userId, [fanMessage], body.sourceMessageId);
      }
      await finishAiGenerationJob(jobId, {
        status: "completed",
        responsePayload: { count: 1 },
        durationMs: Date.now() - aiStartedAt
      });
      sendJson(req, res, 200, { fanMessage, requestId: id }, {
        "X-RateLimit-Remaining": String(limited.remaining)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/ai/live-fan-messages") {
      const body = await readJson(req);
      const userId = getUserId(req, body);
      const aiStartedAt = Date.now();
      const jobId = await recordAiJobStart({
        userId,
        operation: "live_fan_messages",
        sourceMessageId: body.sourceMessageId,
        requestPayload: { recentArtistMessage: body.recentArtistMessage, count: body.count }
      });
      const fanMessages = await generateLiveFanMessages(body.recentArtistMessage, body.count);
      if (userId && body.persist !== false && isDbEnabled()) {
        await createFanMessages(userId, fanMessages, body.sourceMessageId);
      }
      await finishAiGenerationJob(jobId, {
        status: "completed",
        responsePayload: { count: fanMessages.length },
        durationMs: Date.now() - aiStartedAt
      });
      sendJson(req, res, 200, { fanMessages, requestId: id }, {
        "X-RateLimit-Remaining": String(limited.remaining)
      });
      return;
    }

    sendJson(req, res, 404, { error: "Not found.", requestId: id });
  } catch (error) {
    logError({
      requestId: id,
      method: req.method,
      path: url.pathname,
      ip,
      error
    });
    sendJson(req, res, 500, {
      error: "Internal server error.",
      requestId: id
    });
  } finally {
    const durationMs = Date.now() - startedAt;
    const event = {
      requestId: id,
      method: req.method,
      path: url.pathname,
      statusCode: res.statusCode,
      durationMs,
      ip,
      userAgent: req.headers["user-agent"] || ""
    };

    logRequest(event);
    if (durationMs >= slowRequestMs) {
      logSlowRequest({ ...event, slowRequestMs });
    }
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Idol Mode API listening on http://0.0.0.0:${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
