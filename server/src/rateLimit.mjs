/**
 * rateLimit.mjs — 内存滑动窗口限流
 *
 * 支持两个维度：
 *   - key（通常是 IP）：全局请求限流
 *   - aiKey（IP + 操作类型）：AI 接口单独更严格限流
 *
 * PM2 cluster 模式下每个进程独立计数，实际限制 = limit × 进程数。
 * 设计上预留了 Redis 迁移接口（相同函数签名），未来只需替换实现。
 */

const buckets = new Map();

/**
 * 通用滑动窗口限流。
 * @param {{ key: string, limit?: number, windowMs?: number }} opts
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export function rateLimit({ key, limit = 90, windowMs = 60_000 }) {
  const now = Date.now();
  const current = buckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > current.resetAt) {
    current.count = 0;
    current.resetAt = now + windowMs;
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    allowed: current.count <= limit,
    remaining: Math.max(limit - current.count, 0),
    resetAt: current.resetAt
  };
}

/**
 * AI 接口专用限流（更严格）。
 * key 格式：`ai:{ip}:{operation}`，例如 `ai:1.2.3.4:reaction_burst`
 *
 * 默认限制：
 *   - reaction_burst：每分钟 6 次（PM2 × 2 进程 = 实际 12 次）
 *   - live_batch：每分钟 60 次（前端有 45s 冷却，实际触发 < 2 次/分钟）
 *   - 其他 AI 操作：每分钟 15 次
 *
 * @param {{ ip: string, operation: string }} opts
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export function rateLimitAi({ ip, operation }) {
  const limits = {
    reaction_burst: Number(process.env.RATE_LIMIT_AI_REACTION || 6),
    live_batch:     Number(process.env.RATE_LIMIT_AI_LIVE_BATCH || 60),
    default:        Number(process.env.RATE_LIMIT_AI_DEFAULT || 15)
  };

  const limit = limits[operation] ?? limits.default;
  const key = `ai:${ip}:${operation}`;

  return rateLimit({ key, limit, windowMs: 60_000 });
}

// 每 2 分钟清理过期 bucket，防止内存泄漏
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of buckets.entries()) {
    if (now > value.resetAt) buckets.delete(key);
  }
}, 120_000).unref();
