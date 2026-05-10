const buckets = new Map();

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

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of buckets.entries()) {
    if (now > value.resetAt) buckets.delete(key);
  }
}, 120_000).unref();
