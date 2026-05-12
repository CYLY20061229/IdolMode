/**
 * growthEngine.mjs
 *
 * 偶像成长系统核心逻辑：
 *   - 营业值计算（每日上限 100）
 *   - 粉丝增长结算
 *   - 连续营业成就
 *   - 掉粉机制
 *   - 三个工具函数：getReactionCount / getHistoryBurstCount / getLiveDripInterval
 */

// ── 常量 ──────────────────────────────────────────────────────────────────────

export const MAX_DAILY_BV = 100;

/** 连续营业成就定义 */
export const STREAK_ACHIEVEMENTS = [
  { streakDays: 3,  id: "streak_3",  label: "热情可爱初级豆",  bonusFollowers: 300  },
  { streakDays: 5,  id: "streak_5",  label: "稳定营业安心豆",  bonusFollowers: 800  },
  { streakDays: 10, id: "streak_10", label: "口碑超高敬业豆",  bonusFollowers: 1500 },
  { streakDays: 30, id: "streak_30", label: "超级无敌完美豆",  bonusFollowers: 5000 },
];

// ── 工具 ──────────────────────────────────────────────────────────────────────

/** 返回 [min, max] 之间的随机整数（含两端） */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 获取 UTC+8 当天日期字符串 YYYY-MM-DD */
export function todayCST() {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

/** 计算两个 YYYY-MM-DD 字符串之间相差的天数（b - a） */
function daysBetween(a, b) {
  if (!a || !b) return 0;
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

// ── 营业值增量 ────────────────────────────────────────────────────────────────

/**
 * 根据消息类型计算本次营业值增量。
 * @param {object} params
 * @param {string} params.text          - 消息文本
 * @param {string} [params.attachmentType] - "background" | "sticker" | undefined
 * @param {boolean} params.isFirstToday - 今天是否第一次营业
 * @param {number}  params.currentBV    - 当前 dailyBusinessValue
 * @returns {number} 实际增量（已考虑上限）
 */
export function calcBusinessValueDelta({ text, attachmentType, isFirstToday, currentBV }) {
  if (currentBV >= MAX_DAILY_BV) return 0;

  let delta = 0;

  if (attachmentType === "background" || attachmentType === "sticker") {
    delta += 18; // 发图片
  } else {
    const len = String(text || "").trim().length;
    delta += len > 40 ? 15 : 10; // 长文字 +15，普通 +10
  }

  if (isFirstToday) delta += 10; // 每日第一次额外 +10

  // 不超过上限
  return Math.min(delta, MAX_DAILY_BV - currentBV);
}

// ── 粉丝增长结算 ──────────────────────────────────────────────────────────────

/**
 * 根据 dailyBusinessValue 计算今日粉丝增量（含随机浮动）。
 * @param {number} bv
 * @returns {number}
 */
export function calcFollowerGain(bv) {
  if (bv <= 0)  return 0;
  if (bv === 100) return 350 + randInt(-20, 20);
  if (bv >= 81) return randInt(150, 300);
  if (bv >= 51) return randInt(50, 150);
  if (bv >= 21) return randInt(10, 50);
  return randInt(5, 10); // 1–20
}

// ── 掉粉计算 ──────────────────────────────────────────────────────────────────

/**
 * 计算掉粉数量。
 * - 连续 1-2 天不来：不掉粉
 * - 第 3 天起按比例掉粉，最多每天 2%，每日上限 5000
 * - 新用户前 7 天保护
 * - 粉丝数不低于 initialFollowers
 *
 * @param {object} params
 * @param {number} params.inactiveDays
 * @param {number} params.followers
 * @param {number} params.initialFollowers
 * @param {string} params.createdDate       - YYYY-MM-DD
 * @returns {number} 掉粉数（正数）
 */
export function calcFollowerLoss({ inactiveDays, followers, initialFollowers, createdDate }) {
  if (inactiveDays < 3) return 0;

  // 新用户 7 天保护
  const daysSinceCreate = daysBetween(createdDate, todayCST());
  if (daysSinceCreate < 7) return 0;

  // 掉粉比例：3天0.3%，4天0.6%，5天0.9%，之后每天+0.3%，上限2%
  const rawRate = Math.min(0.003 * (inactiveDays - 2), 0.02);
  const loss = Math.floor(followers * rawRate);

  // 每日上限 5000，且不低于 initialFollowers
  const maxLoss = Math.min(loss, 5000);
  const floor = initialFollowers ?? 0;
  return Math.min(maxLoss, Math.max(0, followers - floor));
}

// ── 每日结算 ──────────────────────────────────────────────────────────────────

/**
 * 执行每日结算，返回更新后的 stats 对象（不含 user_id）。
 * 调用方负责写入数据库。
 *
 * @param {object} stats - 当前 idol_growth_stats 行（camelCase）
 * @returns {{ patch: object, newAchievements: string[], bonusFollowers: number }}
 */
export function settleDailyGrowth(stats) {
  const today = todayCST();
  const lastSettlement = stats.lastSettlementDate;

  // 已经结算过今天，跳过
  if (lastSettlement === today) {
    return { patch: {}, newAchievements: [], bonusFollowers: 0 };
  }

  const lastActive = stats.lastActiveDate;
  const daysSinceActive = lastActive ? daysBetween(lastActive, today) : 999;

  // ── 连续营业 / 断签判断 ──
  let streakDays = stats.streakDays ?? 0;
  let inactiveDays = stats.inactiveDays ?? 0;

  if (daysSinceActive === 1) {
    // 昨天营业了，连续+1
    streakDays += 1;
    inactiveDays = 0;
  } else if (daysSinceActive === 0) {
    // 今天已经营业（结算在当天触发），保持
    inactiveDays = 0;
  } else {
    // 断签
    streakDays = 0;
    inactiveDays = daysSinceActive;
  }

  // ── 粉丝增长 ──
  const bv = stats.dailyBusinessValue ?? 0;
  const gain = calcFollowerGain(bv);

  // ── 掉粉 ──
  const loss = calcFollowerLoss({
    inactiveDays,
    followers: stats.followers ?? 0,
    initialFollowers: stats.initialFollowers ?? 0,
    createdDate: stats.createdDate ?? today
  });

  let followers = Math.max(
    stats.initialFollowers ?? 0,
    (stats.followers ?? 0) + gain - loss
  );

  // ── 成就检查 ──
  // stats.unlockedAchievements 已由 rowToGrowthStats 解析为数组，直接使用
  const rawAchievements = Array.isArray(stats.unlockedAchievements)
    ? stats.unlockedAchievements
    : JSON.parse(stats.unlockedAchievements || "[]");
  const unlocked = new Set(rawAchievements);
  const newAchievements = [];
  let bonusFollowers = 0;

  for (const ach of STREAK_ACHIEVEMENTS) {
    if (streakDays >= ach.streakDays && !unlocked.has(ach.id)) {
      unlocked.add(ach.id);
      newAchievements.push(ach.id);
      bonusFollowers += ach.bonusFollowers;
    }
  }
  followers += bonusFollowers;

  const patch = {
    followers,
    streakDays,
    inactiveDays,
    totalEcho: (stats.totalEcho ?? 0) + bv,
    dailyBusinessValue: 0,          // 每日重置
    lastSettlementDate: today,
    unlockedAchievements: JSON.stringify([...unlocked]),
    updatedAt: Date.now()
  };

  return { patch, newAchievements, bonusFollowers };
}

// ── 三个工具函数（前后端共用逻辑，后端直接调用） ──────────────────────────────

/**
 * 根据营业值和粉丝数计算 reaction-burst 数量。
 * @param {number} dailyBusinessValue
 * @param {number} followers
 * @returns {number} 最终 reaction 数量（上限 80）
 */
export function getReactionCount(dailyBusinessValue, followers) {
  let base;
  if (dailyBusinessValue < 30)      base = 12;
  else if (dailyBusinessValue < 60) base = 20;
  else if (dailyBusinessValue < 90) base = 32;
  else                               base = 45;

  let bonus;
  if (followers < 1000)        bonus = 0;
  else if (followers < 10000)  bonus = 6;
  else if (followers < 100000) bonus = 12;
  else                          bonus = 20;

  return Math.min(base + bonus, 80);
}

/**
 * 根据粉丝数计算历史消息 burst 数量（ambient pool 拉取数）。
 * @param {number} followers
 * @returns {number}
 */
export function getHistoryBurstCount(followers) {
  if (followers < 500)         return 8;
  if (followers < 5000)        return 14;
  if (followers < 50000)       return 22;
  if (followers < 500000)      return 32;
  return 45;
}

/**
 * 根据粉丝数计算 live drip 间隔（毫秒）。
 * 粉丝越多，消息越频繁（间隔越短）。
 * @param {number} followers
 * @returns {number} 毫秒
 */
export function getLiveDripInterval(followers) {
  if (followers < 500)         return 6000;
  if (followers < 5000)        return 4500;
  if (followers < 50000)       return 3000;
  if (followers < 500000)      return 2000;
  return 1200;
}
