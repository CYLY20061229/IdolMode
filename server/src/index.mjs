import http from "node:http";
import { createDeviceSession, createJwtToken, getBearerToken, getSessionUserId, resolveUserId, revokeAllDeviceSessionsForUser, revokeSession } from "./auth.mjs";
import { checkAiConnection, generateFanMessages, generateImageCaption, generateLiveFanMessage, generateLiveFanMessages, generateReactionBurst, getAiConfig, transcribeAudio } from "./aiClient.mjs";
import { isDbEnabled } from "./db.mjs";
import { pool } from "./db/pool.mjs";
import { loadEnvFiles } from "./env.mjs";
import { logError, logRequest, logSlowRequest } from "./logger.mjs";
import { createOssPutSignature } from "./oss.mjs";
import { decryptEmail, encryptEmail, generateEmailCode, hashEmail, hashEmailCode, hashIp, maskEmail, normalizeEmail } from "./emailSecurity.mjs";
import { rateLimit, rateLimitAi } from "./rateLimit.mjs";
import { sendEmailCode } from "./emailProvider.mjs";
import { getAmbientMessages, warmUp } from "./ambientPool.mjs";
import { extractAndSaveMemories, buildMemoryContext } from "./memoryExtractor.mjs";
import { calcBusinessValueDelta, DAILY_SELF_MESSAGE_LIMIT, getReactionCount, todayCST } from "./growthEngine.mjs";
import {
  addArtistFriend,
  addBusinessValue,
  anonymizeUserAccount,
  applyGrowthSettlement,
  archiveStaleMemories,
  cleanReactionCache,
  createAiGenerationJob,
  countSentSelfMessagesForDate,
  createFanMessages,
  createIdolChatMessage,
  createReactionCacheSlot,
  createSelfMessage,
  createEmailCodeRecord,
  deleteMemory,
  failReactionCache,
  findOrCreateEmailUserAndMigrateGuest,
  finishAiGenerationJob,
  finishReactionCache,
  getBootstrap,
  getEmailRateStats,
  getUserAccount,
  getUserPreferences,
  getOrCreateGrowthStats,
  getReactionCache,
  listFanMessages,
  listMemories,
  pickHistoryMessages,
  pickMemoriesForGeneration,
  removeArtistFriend,
  runDailySettlementForAll,
  suppressMemory,
  updateMemoryMentioned,
  updateProfile,
  updateUserPreferences,
  updateSelfMessageStatus,
  upsertDeviceUser,
  verifyEmailLoginCode,
  updateMemoryContent,
} from "./repository.mjs";

loadEnvFiles();

// 启动时预热 ambient pool（异步，不阻塞）
warmUp();

// 每小时清理过期 reaction_cache（TTL 2h）
setInterval(() => {
  if (isDbEnabled()) {
    cleanReactionCache().catch(() => {/* 清理失败不影响主流程 */});
  }
}, 60 * 60 * 1000).unref();

// 每 24 小时归档过期记忆（emotion 7天，低重要度 30天）
setInterval(() => {
  if (isDbEnabled()) {
    archiveStaleMemories().catch(() => {/* 归档失败不影响主流程 */});
  }
}, 24 * 60 * 60 * 1000).unref();

// 每 24 小时执行成长系统每日结算
setInterval(() => {
  if (isDbEnabled()) {
    runDailySettlementForAll().catch(() => {/* 结算失败不影响主流程 */});
  }
}, 24 * 60 * 60 * 1000).unref();

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
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-Id, X-User-Id",
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

function readJson(req, maxBytes = 32_768) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) {
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

function publicUserPayload(account, emailMasked = "") {
  if (!account) return null;
  return {
    id: String(account.user.id),
    nickname: account.profile?.nickname || "New Idol",
    avatar: account.profile?.avatar || "IM",
    role: account.user.role || "user",
    isEmailVerified: Boolean(account.user.is_email_verified),
    emailMasked: emailMasked || account.user.email_masked || "",
    entitlement: account.entitlement
  };
}

function accountResponse(account, normalizedEmail = "") {
  const user = publicUserPayload(account, normalizedEmail ? maskEmail(normalizedEmail) : "");
  return {
    user,
    profile: account?.profile || null,
    entitlement: account?.entitlement || null,
    preferences: account?.preferences || { fanNotificationsEnabled: false, autoTranslateEnabled: false }
  };
}

function sendDatabaseUnavailable(req, res, requestId) {
  sendJson(req, res, 503, {
    error: "Database is not configured.",
    requestId
  });
}

function decodeAudioBase64(value) {
  const raw = String(value || "").replace(/^data:[^;]+;base64,/, "").trim();
  if (!raw) return Buffer.alloc(0);
  return Buffer.from(raw, "base64");
}

function safeAudioMimeType(value) {
  const mimeType = String(value || "audio/m4a").toLowerCase();
  return /^audio\/[a-z0-9.+-]+$/.test(mimeType) ? mimeType : "audio/m4a";
}

async function requireDatabaseUser(req, res, requestId, body = {}) {
  if (!isDbEnabled()) {
    sendDatabaseUnavailable(req, res, requestId);
    return "";
  }

  const userId = await resolveUserId(req, body);
  if (!userId) {
    sendJson(req, res, 401, {
      error: "Missing session. Send Authorization: Bearer <sessionToken>.",
      requestId
    });
    return "";
  }

  return String(userId);
}
async function getArtistProfileForUser(userId) {
  if (!userId || !isDbEnabled()) return {};
  try {
    const account = await getUserAccount(userId);
    return account?.profile || {};
  } catch {
    return {};
  }
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

async function recordAiJobFailure(jobId, error, startedAt) {
  await finishAiGenerationJob(jobId, {
    status: "failed",
    errorMessage: error instanceof Error ? error.message : String(error),
    durationMs: Date.now() - startedAt
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

    if (req.method === "GET" && url.pathname === "/api/health/ai") {
      try {
        const result = await checkAiConnection();
        sendJson(req, res, 200, result);
      } catch (error) {
        const config = getAiConfig();
        sendJson(req, res, 500, {
          ok: false,
          provider: config.provider,
          model: config.model,
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

    if (req.method === "POST" && url.pathname === "/api/auth/email/send") {
      if (!isDbEnabled()) {
        sendDatabaseUnavailable(req, res, id);
        return;
      }

      const body = await readJson(req);
      const purpose = String(body.purpose || "login");
      if (purpose !== "login") {
        sendJson(req, res, 400, { error: "Invalid email purpose.", requestId: id });
        return;
      }

      let normalizedEmail;
      try {
        normalizedEmail = normalizeEmail(body.email);
      } catch (error) {
        sendJson(req, res, 400, { error: error instanceof Error ? error.message : "邮箱格式不正确。", requestId: id });
        return;
      }

      const emailHash = hashEmail(normalizedEmail);
      const ipHash = hashIp(ip);
      const now = Date.now();
      const stats = await getEmailRateStats({ emailHash, ipHash, now });
      if (stats.emailCooldownCount > 0) {
        sendJson(req, res, 429, { error: "EMAIL_COOLDOWN", message: "请 60 秒后再获取验证码。", requestId: id });
        return;
      }
      if (stats.emailDailyCount >= 10) {
        sendJson(req, res, 429, { error: "EMAIL_DAILY_LIMIT", message: "今天验证码次数已用完，请明天再试。", requestId: id });
        return;
      }
      if (stats.ipHourlyCount >= 20) {
        sendJson(req, res, 429, { error: "EMAIL_IP_LIMIT", message: "请求过于频繁，请稍后再试。", requestId: id });
        return;
      }

      const code = generateEmailCode();
      const codeHash = hashEmailCode({ normalizedEmail, code, purpose });
      const expiresAt = now + 10 * 60 * 1000;
      await createEmailCodeRecord({
        id: `email-${now}-${Math.random().toString(36).slice(2, 10)}`,
        emailHash,
        codeHash,
        purpose,
        ipHash,
        expiresAt,
        createdAt: now
      });
      await sendEmailCode({ email: normalizedEmail, code });
      sendJson(req, res, 200, {
        ok: true,
        cooldownSeconds: 60,
        expiresInSeconds: 600,
        emailMasked: maskEmail(normalizedEmail),
        requestId: id
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/email/login") {
      if (!isDbEnabled()) {
        sendDatabaseUnavailable(req, res, id);
        return;
      }

      const body = await readJson(req);
      const purpose = "login";
      let normalizedEmail;
      try {
        normalizedEmail = normalizeEmail(body.email);
      } catch (error) {
        sendJson(req, res, 400, { error: error instanceof Error ? error.message : "邮箱格式不正确。", requestId: id });
        return;
      }
      const code = String(body.code || "").trim();
      if (!/^\d{6}$/.test(code)) {
        sendJson(req, res, 400, { error: "请输入 6 位验证码。", requestId: id });
        return;
      }

      const emailHash = hashEmail(normalizedEmail);
      const codeHash = hashEmailCode({ normalizedEmail, code, purpose });
      const verified = await verifyEmailLoginCode({ emailHash, codeHash, purpose, now: Date.now() });
      if (!verified.ok) {
        sendJson(req, res, 400, { error: "EMAIL_CODE_INVALID", message: verified.reason, requestId: id });
        return;
      }

      const bearerToken = getBearerToken(req);
      const guestUserId = bearerToken?.startsWith("idm_") ? await getSessionUserId(bearerToken) : "";
      const account = await findOrCreateEmailUserAndMigrateGuest({
        emailHash,
        emailEncrypted: encryptEmail(normalizedEmail),
        emailMasked: maskEmail(normalizedEmail),
        guestUserId,
        now: Date.now()
      });
      const token = createJwtToken(account.user.id);
      sendJson(req, res, 200, {
        ok: true,
        token,
        ...accountResponse(account, normalizedEmail),
        requestId: id
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const userId = await requireDatabaseUser(req, res, id);
      if (!userId) return;
      const account = await getUserAccount(userId);
      if (!account) {
        sendJson(req, res, 404, { error: "User not found.", requestId: id });
        return;
      }
      let normalizedEmail = "";
      try {
        normalizedEmail = account.user.email_encrypted ? decryptEmail(account.user.email_encrypted) : "";
      } catch {
        normalizedEmail = "";
      }
      sendJson(req, res, 200, { ...accountResponse(account, normalizedEmail), requestId: id });
      return;
    }

    if (req.method === "DELETE" && url.pathname === "/api/me/account") {
      const body = await readJson(req);
      const userId = await requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      await anonymizeUserAccount(userId, Date.now());
      const bearerToken = getBearerToken(req);
      if (bearerToken.startsWith("idm_")) await revokeSession(bearerToken);
      await revokeAllDeviceSessionsForUser(userId);
      sendJson(req, res, 200, { ok: true, requestId: id });
      return;
    }

    if (req.method === "PATCH" && url.pathname === "/api/me/preferences") {
      const body = await readJson(req);
      const userId = await requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const preferences = await updateUserPreferences(userId, body.preferences || body);
      sendJson(req, res, 200, { preferences, requestId: id });
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
      const session = await createDeviceSession({
        userId: auth.user.id,
        deviceId: body.deviceId,
        platform: body.platform
      });
      sendJson(req, res, 200, { ...auth, ...session, requestId: id });
      return;
    }

    if (req.method === "GET" && url.pathname === "/auth/session") {
      const userId = await requireDatabaseUser(req, res, id);
      if (!userId) return;
      const data = await getBootstrap(userId);
      sendJson(req, res, 200, { userId, ...data, requestId: id });
      return;
    }

    if (req.method === "POST" && url.pathname === "/auth/logout") {
      if (!isDbEnabled()) {
        sendDatabaseUnavailable(req, res, id);
        return;
      }
      const revoked = await revokeSession(getBearerToken(req));
      sendJson(req, res, 200, { ok: true, revoked, requestId: id });
      return;
    }

    if (req.method === "GET" && url.pathname === "/me/bootstrap") {
      const userId = await requireDatabaseUser(req, res, id);
      if (!userId) return;
      const data = await getBootstrap(userId);
      sendJson(req, res, 200, { ...data, requestId: id });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/me/profile") {
      const body = await readJson(req);
      const userId = await requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const profile = await updateProfile(userId, body.profile || body);
      sendJson(req, res, 200, { profile, requestId: id });
      return;
    }

    if (req.method === "POST" && url.pathname === "/me/friends") {
      const body = await readJson(req);
      const userId = await requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const artist = await addArtistFriend(userId, body.artistId);
      sendJson(req, res, 200, { artist, requestId: id });
      return;
    }

    const deleteFriendMatch = url.pathname.match(/^\/me\/friends\/([^/]+)$/);
    if (req.method === "DELETE" && deleteFriendMatch) {
      const userId = await requireDatabaseUser(req, res, id);
      if (!userId) return;
      await removeArtistFriend(userId, decodeURIComponent(deleteFriendMatch[1]));
      sendJson(req, res, 200, { ok: true, requestId: id });
      return;
    }

    if (req.method === "POST" && url.pathname === "/me/self-messages") {
      const body = await readJson(req);
      const userId = await requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const message = await createSelfMessage(userId, body.message || body);

      sendJson(req, res, 200, { message, requestId: id });
      return;
    }

    const selfMessageMatch = url.pathname.match(/^\/me\/self-messages\/([^/]+)$/);
    if (req.method === "PATCH" && selfMessageMatch) {
      const body = await readJson(req);
      const userId = await requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const today = todayCST();
      if (body.status === "sent") {
        const sentToday = await countSentSelfMessagesForDate(userId, today);
        if (sentToday >= DAILY_SELF_MESSAGE_LIMIT) {
          sendJson(req, res, 429, {
            error: "DAILY_SELF_MESSAGE_LIMIT_REACHED",
            message: "明天再来吧，留点神秘感。",
            limit: DAILY_SELF_MESSAGE_LIMIT,
            requestId: id
          });
          return;
        }
      }
      const message = await updateSelfMessageStatus(userId, decodeURIComponent(selfMessageMatch[1]), body.status);

      if (body.status === "sent" && isDbEnabled()) {
        if (message?.text) {
          extractAndSaveMemories(userId, message.text, message.id).catch(() => {});
        }

        (async () => {
          try {
            const stats = await getOrCreateGrowthStats(userId);
            const delta = calcBusinessValueDelta({
              currentBV: stats?.dailyBusinessValue ?? 0
            });
            if (delta > 0) {
              await addBusinessValue(userId, delta, today);
            }
          } catch {/* 营业值更新失败不影响主流程 */}
        })();
      }

      sendJson(req, res, 200, { message, requestId: id });
      return;
    }

    if (req.method === "GET" && url.pathname === "/me/fan-messages") {
      const userId = await requireDatabaseUser(req, res, id);
      if (!userId) return;
      const fanMessages = await listFanMessages(userId, url.searchParams.get("limit") || 200);
      sendJson(req, res, 200, { fanMessages, requestId: id });
      return;
    }

    if (req.method === "POST" && url.pathname === "/me/fan-messages") {
      const body = await readJson(req);
      const userId = await requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const fanMessages = await createFanMessages(userId, body.fanMessages || [], body.fromSelfMessageId);
      sendJson(req, res, 200, { fanMessages, requestId: id });
      return;
    }

    if (req.method === "POST" && url.pathname === "/me/idol-chat-messages") {
      const body = await readJson(req);
      const userId = await requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const message = await createIdolChatMessage(userId, body.artistId, body.message || body);
      sendJson(req, res, 200, { message, requestId: id });
      return;
    }

    if (req.method === "POST" && url.pathname === "/uploads/sign") {
      const body = await readJson(req);
      const userId = await requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      let upload;
      try {
        upload = createOssPutSignature({
          userId,
          kind: body.kind,
          mimeType: body.mimeType
        });
      } catch (error) {
        sendJson(req, res, 500, {
          error: "OSS_UPLOAD_NOT_CONFIGURED",
          message: error instanceof Error ? error.message : "OSS upload is not configured.",
          requestId: id
        });
        return;
      }
      sendJson(req, res, 200, { upload, requestId: id });
      return;
    }

    // ── 成长系统 ──────────────────────────────────────────────────────────────

    if (req.method === "GET" && url.pathname === "/me/growth") {
      const userId = await requireDatabaseUser(req, res, id);
      if (!userId) return;
      const stats = await getOrCreateGrowthStats(userId);
      sendJson(req, res, 200, { stats, requestId: id });
      return;
    }

    if (req.method === "PATCH" && url.pathname === "/me/growth/settle") {
      const body = await readJson(req);
      const userId = await requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const { settleDailyGrowth } = await import("./growthEngine.mjs");
      const stats = await getOrCreateGrowthStats(userId);
      const preferences = await getUserPreferences(userId);
      const { patch, newAchievements, bonusFollowers } = settleDailyGrowth(stats, {
        followerLossEnabled: preferences.fanNotificationsEnabled
      });
      if (Object.keys(patch).length > 0) {
        await applyGrowthSettlement(userId, patch);
      }
      const updated = await getOrCreateGrowthStats(userId);
      sendJson(req, res, 200, { stats: updated, newAchievements, bonusFollowers, requestId: id });
      return;
    }

    // ── 用户记忆管理 ──────────────────────────────────────────────────────────

    if (req.method === "GET" && url.pathname === "/me/memories") {
      const userId = await requireDatabaseUser(req, res, id);
      if (!userId) return;
      const memories = await listMemories(userId);
      sendJson(req, res, 200, { memories, requestId: id });
      return;
    }

    const memoryMatch = url.pathname.match(/^\/me\/memories\/([^/]+)$/);

    if (req.method === "DELETE" && memoryMatch) {
      const userId = await requireDatabaseUser(req, res, id);
      if (!userId) return;
      await deleteMemory(userId, decodeURIComponent(memoryMatch[1]));
      sendJson(req, res, 200, { ok: true, requestId: id });
      return;
    }
if (req.method === "PATCH" && memoryMatch) {
  const body = await readJson(req);
  const userId = await requireDatabaseUser(req, res, id, body);
  if (!userId) return;

  const memoryId = decodeURIComponent(memoryMatch[1]);

  if (body.action === "suppress") {
    await suppressMemory(userId, memoryId);
    sendJson(req, res, 200, { ok: true, requestId: id });
    return;
  }

  if (body.action === "update") {
    const memory = await updateMemoryContent(userId, memoryId, {
      content: body.content,
      memoryType: body.memoryType
    });

    if (!memory) {
      sendJson(req, res, 404, { error: "Memory not found.", requestId: id });
      return;
    }

    sendJson(req, res, 200, { ok: true, memory, requestId: id });
    return;
  }

  sendJson(req, res, 400, { error: "Unknown action.", requestId: id });
  return;
}

    // POST /me/memories — 用户手动写入记忆
    if (req.method === "POST" && url.pathname === "/me/memories") {
      const body = await readJson(req);
      const userId = await requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const content = String(body.content || "").trim();
      const memoryType = String(body.memoryType || "life_event").trim();
      if (!content) {
        sendJson(req, res, 400, { error: "content is required.", requestId: id });
        return;
      }
      const validTypes = ["preference", "habit", "life_event", "creative_context", "emotion"];
      if (!validTypes.includes(memoryType)) {
        sendJson(req, res, 400, { error: "Invalid memoryType.", requestId: id });
        return;
      }
      const crypto = await import("node:crypto");
      const { insertOrUpdateMemory } = await import("./repository.mjs");
      const memoryId = `user-write-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const hash = crypto.createHash("sha256").update(`${userId}:${content}`).digest("hex");
      const inserted = await insertOrUpdateMemory({
        id: memoryId,
        userId,
        memoryType,
        content,
        importance: 4,
        sourceMessageId: null,
        sourcePreview: "用户手动写入",
        hash,
        now: Date.now()
      });
      sendJson(req, res, 200, { ok: true, inserted, requestId: id });
      return;
    }

    if (req.method === "POST" && url.pathname === "/ai/live-batch") {
      // AI 专用限流（比全局更严格）
      const aiLimited = rateLimitAi({ ip, operation: "live_batch" });
      if (!aiLimited.allowed) {
        sendJson(req, res, 429, { error: "AI rate limit exceeded.", requestId: id }, {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(aiLimited.resetAt)
        });
        return;
      }

      const body = await readJson(req);
      const safeCount = Math.max(1, Math.min(Number(body.count) || 30, 60));

      // 从 ambient pool 取（内存缓冲 → PG → 模板 fallback，不调 AI）
      const fanMessages = await getAmbientMessages(safeCount, body.timeContext);
      sendJson(req, res, 200, { fanMessages, requestId: id }, {
        "X-RateLimit-Remaining": String(aiLimited.remaining)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/ai/image-caption") {
      const aiLimited = rateLimitAi({ ip, operation: "image_caption" });
      if (!aiLimited.allowed) {
        sendJson(req, res, 429, { error: "AI rate limit exceeded.", requestId: id }, {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(aiLimited.resetAt)
        });
        return;
      }

      const body = await readJson(req);
      const userId = await requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const aiStartedAt = Date.now();
      const imageHost = (() => {
        try { return new URL(String(body.imageUrl || "")).hostname; } catch { return "invalid"; }
      })();
      const jobId = await recordAiJobStart({
        userId,
        operation: "image_caption",
        requestPayload: { imageHost }
      });
      try {
        const imageCaption = await generateImageCaption(body.imageUrl);
        await finishAiGenerationJob(jobId, {
          status: "completed",
          responsePayload: { imageCaption },
          durationMs: Date.now() - aiStartedAt
        });
        sendJson(req, res, 200, { imageCaption, requestId: id }, {
          "X-RateLimit-Remaining": String(aiLimited.remaining)
        });
      } catch (error) {
        await recordAiJobFailure(jobId, error, aiStartedAt);
        throw error;
      }
      return;
    }

    if (req.method === "POST" && (url.pathname === "/api/voice/transcribe" || url.pathname === "/ai/reaction-burst-from-audio")) {
      const aiLimited = rateLimitAi({ ip, operation: "voice_reaction_burst" });
      if (!aiLimited.allowed) {
        sendJson(req, res, 429, { error: "AI rate limit exceeded.", requestId: id }, {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(aiLimited.resetAt)
        });
        return;
      }

      const maxJsonBytes = Number(process.env.MAX_AUDIO_JSON_BYTES || 7_000_000);
      const maxAudioBytes = Number(process.env.MAX_AUDIO_BYTES || 5_000_000);
      const body = await readJson(req, maxJsonBytes);
      const userId = await resolveUserId(req, body);
      const sourceMessageId = String(body.sourceMessageId || `voice-${Date.now()}`).trim();
      const audioUrl = typeof body.audioUrl === "string" && /^https?:\/\//.test(body.audioUrl)
        ? body.audioUrl.trim()
        : "";
      const audioBuffer = audioUrl ? Buffer.alloc(0) : decodeAudioBase64(body.audioBase64);
      if (!sourceMessageId) {
        sendJson(req, res, 400, { error: "sourceMessageId is required.", requestId: id });
        return;
      }
      if (!audioUrl && !audioBuffer.length) {
        sendJson(req, res, 400, { error: "audioUrl or audioBase64 is required.", requestId: id });
        return;
      }
      if (audioBuffer.length && audioBuffer.length > maxAudioBytes) {
        sendJson(req, res, 413, { error: "Audio file is too large.", requestId: id });
        return;
      }

      const aiStartedAt = Date.now();
      const skipFanMessages = body.skipFanMessages === true;
      const safeCount = skipFanMessages ? 0 : Math.max(8, Math.min(Number(body.count) || 32, 40));
      const mimeType = safeAudioMimeType(body.mimeType);
      const audioDataUrl = audioUrl || (String(body.audioBase64 || "").startsWith("data:")
        ? String(body.audioBase64)
        : `data:${mimeType};base64,${body.audioBase64}`);
      const jobId = await recordAiJobStart({
        userId,
        operation: "voice_reaction_burst",
        sourceMessageId,
        requestPayload: {
          audioBytes: audioBuffer.length || null,
          audioUrl: audioUrl || null,
          durationMs: Number(body.durationMs) || null,
          mimeType,
          count: safeCount
        }
      });
      try {
        const recognizedText = await transcribeAudio({ audioBase64: audioDataUrl, audioBuffer, mimeType });
        if (!recognizedText) {
          sendJson(req, res, 400, { error: "ASR returned empty text.", requestId: id });
          await finishAiGenerationJob(jobId, {
            status: "failed",
            errorMessage: "ASR returned empty text.",
            durationMs: Date.now() - aiStartedAt
          });
          return;
        }

        let memoryContext = "";
        let candidateMemories = [];
        if (!skipFanMessages && userId && isDbEnabled()) {
          candidateMemories = await pickMemoriesForGeneration(userId).catch(() => []);
          memoryContext = buildMemoryContext(candidateMemories);
        }

        const fanMessages = skipFanMessages
          ? []
          : await generateReactionBurst(recognizedText, safeCount, body.quotedContent || null, memoryContext, body.timeContext, body.imageCaption || "");

        if (!skipFanMessages && candidateMemories.length > 0 && isDbEnabled()) {
          const usedIds = fanMessages
            .flatMap((m) => (Array.isArray(m.usedMemoryIds) ? m.usedMemoryIds : []))
            .filter((mid) => candidateMemories.some((cm) => cm.id === mid));
          const deduped = [...new Set(usedIds)].slice(0, 1);
          if (deduped.length > 0) {
            updateMemoryMentioned(deduped, Date.now()).catch(() => {});
          }
        }

        if (userId && isDbEnabled()) {
          await createSelfMessage(userId, {
            id: sourceMessageId,
            text: recognizedText,
            status: "sent",
            createdAt: body.createdAt || null,
            attachmentType: "voice",
            attachmentUri: audioUrl || null
          });
          await createFanMessages(userId, fanMessages, sourceMessageId);
        }

        await finishAiGenerationJob(jobId, {
          status: "completed",
          responsePayload: {
            recognizedTextLength: recognizedText.length,
            count: fanMessages.length
          },
          durationMs: Date.now() - aiStartedAt
        });
        sendJson(req, res, 200, { recognizedText, fanMessages, requestId: id }, {
          "X-RateLimit-Remaining": String(aiLimited.remaining)
        });
      } catch (error) {
        await recordAiJobFailure(jobId, error, aiStartedAt);
        throw error;
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/ai/reaction-burst") {
      // AI 专用限流
      const aiLimited = rateLimitAi({ ip, operation: "reaction_burst" });
      if (!aiLimited.allowed) {
        sendJson(req, res, 429, { error: "AI rate limit exceeded.", requestId: id }, {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(aiLimited.resetAt)
        });
        return;
      }

      const body = await readJson(req);
      const userId = await resolveUserId(req, body);
      const sourceMessageId = body.sourceMessageId;

      // ── reaction_cache 去重：同一 sourceMessageId 只调一次 AI ──
      if (sourceMessageId && isDbEnabled()) {
        const cached = await getReactionCache(sourceMessageId);

        if (cached?.status === "done" && cached.result?.fanMessages?.length) {
          // 命中缓存，直接返回
          sendJson(req, res, 200, {
            fanMessages: cached.result.fanMessages,
            fromCache: true,
            requestId: id
          }, { "X-RateLimit-Remaining": String(aiLimited.remaining) });
          return;
        }

        if (cached?.status === "processing") {
          // 另一个进程正在生成，返回 pending 让前端稍后重试
          sendJson(req, res, 202, {
            status: "processing",
            retryAfterMs: 3000,
            requestId: id
          });
          return;
        }

        // 占位：INSERT ... ON CONFLICT DO NOTHING
        const gotSlot = await createReactionCacheSlot(sourceMessageId);
        if (!gotSlot) {
          // 并发情况下被其他进程抢先，返回 pending
          sendJson(req, res, 202, {
            status: "processing",
            retryAfterMs: 3000,
            requestId: id
          });
          return;
        }
      }

      const aiStartedAt = Date.now();
      // 固定允许 8–40 条，不再根据粉丝数动态限制
      const safeCount = Math.max(8, Math.min(Number(body.count) || 32, 40));
      const jobId = await recordAiJobStart({
        userId,
        operation: "reaction_burst",
        sourceMessageId,
        requestPayload: { message: body.message, count: safeCount, imageCaption: body.imageCaption ? "present" : "none" }
      });
      try {
        // Phase 5: 注入用户记忆上下文
        let memoryContext = "";
        let candidateMemories = [];
        if (userId && isDbEnabled()) {
          candidateMemories = await pickMemoriesForGeneration(userId).catch(() => []);
          memoryContext = buildMemoryContext(candidateMemories);
        }

        // const fanMessages = await generateReactionBurst(body.message, safeCount, body.quotedContent || null, memoryContext, body.timeContext, body.imageCaption || "");
const artistProfile = await getArtistProfileForUser(userId);

const fanMessages = await generateReactionBurst(
  body.message,
  safeCount,
  body.quotedContent || null,
  memoryContext,
  body.timeContext,
  body.imageCaption || "",
  artistProfile
);
        // Phase 5: 收集本批次实际使用的 memoryIds，更新 mention 统计
        if (candidateMemories.length > 0 && isDbEnabled()) {
          const usedIds = fanMessages
            .flatMap((m) => (Array.isArray(m.usedMemoryIds) ? m.usedMemoryIds : []))
            .filter((mid) => candidateMemories.some((cm) => cm.id === mid));
          // 去重，最多 1 条（按设计规范）
          const deduped = [...new Set(usedIds)].slice(0, 1);
          if (deduped.length > 0) {
            updateMemoryMentioned(deduped, Date.now()).catch(() => {});
          }
        }

        if (userId && isDbEnabled()) {
          await createFanMessages(userId, fanMessages, sourceMessageId);
        }
        // 写入 reaction_cache
        if (sourceMessageId && isDbEnabled()) {
          await finishReactionCache(sourceMessageId, fanMessages);
        }
        await finishAiGenerationJob(jobId, {
          status: "completed",
          responsePayload: { count: fanMessages.length },
          durationMs: Date.now() - aiStartedAt
        });
        sendJson(req, res, 200, { fanMessages, requestId: id }, {
          "X-RateLimit-Remaining": String(aiLimited.remaining)
        });
      } catch (error) {
        if (sourceMessageId && isDbEnabled()) {
          await failReactionCache(sourceMessageId).catch(() => {});
        }
        await recordAiJobFailure(jobId, error, aiStartedAt);
        throw error;
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/ai/fan-messages") {
      const body = await readJson(req);
      const userId = await resolveUserId(req, body);
      const aiStartedAt = Date.now();
      const jobId = await recordAiJobStart({
        userId,
        operation: "fan_messages",
        sourceMessageId: body.sourceMessageId,
        requestPayload: { message: body.message, count: body.count }
      });
      try {
        // const fanMessages = await generateFanMessages(body.message, body.count, body.timeContext);
        const artistProfile = await getArtistProfileForUser(userId);
const fanMessages = await generateFanMessages(body.message, body.count, body.timeContext, artistProfile);
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
      } catch (error) {
        await recordAiJobFailure(jobId, error, aiStartedAt);
        throw error;
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/ai/live-fan-message") {
      const body = await readJson(req);
      const userId = await resolveUserId(req, body);
      const aiStartedAt = Date.now();
      const jobId = await recordAiJobStart({
        userId,
        operation: "live_fan_message",
        sourceMessageId: body.sourceMessageId,
        requestPayload: { recentArtistMessage: body.recentArtistMessage }
      });
      try {
        const fanMessage = await generateLiveFanMessage(body.recentArtistMessage, body.timeContext);
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
      } catch (error) {
        await recordAiJobFailure(jobId, error, aiStartedAt);
        throw error;
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/ai/live-fan-messages") {
      const body = await readJson(req);
      const userId = await resolveUserId(req, body);
      const aiStartedAt = Date.now();
      const jobId = await recordAiJobStart({
        userId,
        operation: "live_fan_messages",
        sourceMessageId: body.sourceMessageId,
        requestPayload: { recentArtistMessage: body.recentArtistMessage, count: body.count }
      });
      try {
        const safeCount = Math.max(1, Math.min(Number(body.count) || 8, 30));
        const fanMessages = await generateLiveFanMessages(body.recentArtistMessage, safeCount, body.timeContext);
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
      } catch (error) {
        await recordAiJobFailure(jobId, error, aiStartedAt);
        throw error;
      }
      return;
    }

    // 历史消息 burst：从 history_messages 表随机采样，不调用 AI
    if (req.method === "POST" && url.pathname === "/ai/history-burst") {
      if (!isDbEnabled()) {
        // DB 未配置时返回空列表，前端会降级到 mock
        sendJson(req, res, 200, { fanMessages: [], requestId: id });
        return;
      }

      const body = await readJson(req);
      const count = Math.max(1, Math.min(Number(body.count) || 14, 50));
      const fanMessages = await pickHistoryMessages(count, body.timeContext);
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
      error: error instanceof Error ? error.message : "Internal server error.",
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
