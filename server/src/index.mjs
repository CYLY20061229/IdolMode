import http from "node:http";
import { createDeviceSession, getBearerToken, resolveUserId, revokeSession } from "./auth.mjs";
import { checkAiConnection, generateFanMessages, generateLiveFanMessage, generateLiveFanMessages, generateReactionBurst, getAiConfig } from "./aiClient.mjs";
import { isDbEnabled } from "./db.mjs";
import { pool } from "./db/pool.mjs";
import { loadEnvFiles } from "./env.mjs";
import { logError, logRequest, logSlowRequest } from "./logger.mjs";
import { rateLimit, rateLimitAi } from "./rateLimit.mjs";
import { getAmbientMessages, warmUp } from "./ambientPool.mjs";
import { extractAndSaveMemories, buildMemoryContext } from "./memoryExtractor.mjs";
import { calcBusinessValueDelta, getReactionCount, todayCST } from "./growthEngine.mjs";
import {
  addArtistFriend,
  addBusinessValue,
  applyGrowthSettlement,
  archiveStaleMemories,
  cleanReactionCache,
  createAiGenerationJob,
  createFanMessages,
  createIdolChatMessage,
  createReactionCacheSlot,
  createSelfMessage,
  deleteMemory,
  failReactionCache,
  finishAiGenerationJob,
  finishReactionCache,
  getBootstrap,
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
  updateSelfMessageStatus,
  upsertDeviceUser
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

      // 异步触发记忆抽取
      if (message?.text) {
        extractAndSaveMemories(userId, message.text, message.id).catch(() => {});
      }

      // 异步更新营业值
      if (isDbEnabled()) {
        (async () => {
          try {
            const today = todayCST();
            const stats = await getOrCreateGrowthStats(userId);
            const isFirstToday = stats?.lastActiveDate !== today;
            const delta = calcBusinessValueDelta({
              text: message?.text ?? "",
              attachmentType: body.message?.attachmentType ?? body.attachmentType,
              isFirstToday,
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

    const selfMessageMatch = url.pathname.match(/^\/me\/self-messages\/([^/]+)$/);
    if (req.method === "PATCH" && selfMessageMatch) {
      const body = await readJson(req);
      const userId = await requireDatabaseUser(req, res, id, body);
      if (!userId) return;
      const message = await updateSelfMessageStatus(userId, decodeURIComponent(selfMessageMatch[1]), body.status);
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
      const { patch, newAchievements, bonusFollowers } = settleDailyGrowth(stats);
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
      if (body.action === "suppress") {
        await suppressMemory(userId, decodeURIComponent(memoryMatch[1]));
        sendJson(req, res, 200, { ok: true, requestId: id });
      } else {
        sendJson(req, res, 400, { error: "Unknown action.", requestId: id });
      }
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
      const fanMessages = await getAmbientMessages(safeCount);
      sendJson(req, res, 200, { fanMessages, requestId: id }, {
        "X-RateLimit-Remaining": String(aiLimited.remaining)
      });
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
        requestPayload: { message: body.message, count: safeCount }
      });
      try {
        // Phase 5: 注入用户记忆上下文
        let memoryContext = "";
        let candidateMemories = [];
        if (userId && isDbEnabled()) {
          candidateMemories = await pickMemoriesForGeneration(userId).catch(() => []);
          memoryContext = buildMemoryContext(candidateMemories);
        }

        const fanMessages = await generateReactionBurst(body.message, safeCount, body.quotedContent || null, memoryContext);

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
        const fanMessages = await generateLiveFanMessages(body.recentArtistMessage, safeCount);
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
      const fanMessages = await pickHistoryMessages(count);
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
