import { query, transaction } from "./db.mjs";

function rowToProfile(row) {
  if (!row) return null;
  return {
    id: row.user_id,
    nickname: row.nickname,
    signature: row.signature,
    email: row.email,
    avatar: row.avatar,
    gender: row.gender || "",
    age: row.age ?? null,
    statusText: row.status_text ?? undefined,
    backgroundImage: row.background_image ?? undefined
  };
}

function rowToArtist(row) {
  return {
    id: row.id,
    nickname: row.nickname,
    avatar: row.avatar,
    background: row.background,
    bio: row.bio,
    signature: row.signature,
    identity: row.identity,
    fans: row.fans,
    intro: row.intro
  };
}

function rowToSelfMessage(row) {
  return {
    id: row.id,
    sender: "self",
    text: row.text,
    status: row.status,
    createdAt: row.display_time || formatTime(row.created_at)
  };
}

function rowToFanMessage(row) {
  return {
    id: row.id,
    fanName: row.fan_name,
    avatar: row.avatar,
    language: row.language,
    content: row.content,
    translatedContent: row.translated_content || row.content,
    fromMessageId: row.from_self_message_id || undefined,
    personaType: row.persona_type || undefined,
    messageKind: row.message_kind || undefined
  };
}

function rowToIdolChatMessage(row) {
  return {
    id: row.id,
    sender: row.sender,
    text: row.text,
    createdAt: row.display_time || formatTime(row.created_at)
  };
}

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export async function upsertDeviceUser({ deviceId, platform }) {
  if (!deviceId || String(deviceId).trim().length < 6) {
    throw new Error("deviceId must be at least 6 characters.");
  }

  return transaction(async (client) => {
    const userResult = await client.query(
      `INSERT INTO users (device_id, platform, auth_provider)
       VALUES ($1, $2, 'device')
       ON CONFLICT (device_id) DO UPDATE SET
         platform = COALESCE(EXCLUDED.platform, users.platform),
         last_seen_at = now(),
         updated_at = now()
       RETURNING id, device_id, auth_provider, phone, email, apple_sub, platform, created_at, last_seen_at`,
      [String(deviceId), platform || null]
    );
    const user = userResult.rows[0];

    const profileResult = await client.query(
      `INSERT INTO profiles (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING user_id, nickname, signature, email, avatar, gender, age, status_text, background_image`,
      [user.id]
    );

    let profile = profileResult.rows[0];
    if (!profile) {
      const existingProfile = await client.query(
        "SELECT user_id, nickname, signature, email, avatar, gender, age, status_text, background_image FROM profiles WHERE user_id = $1",
        [user.id]
      );
      profile = existingProfile.rows[0];
    }

    return {
      user,
      profile: rowToProfile(profile)
    };
  });
}

export async function updateProfile(userId, profile) {
  const result = await query(
    `UPDATE profiles SET
       nickname = COALESCE($2, nickname),
       signature = COALESCE($3, signature),
       email = COALESCE($4, email),
       avatar = COALESCE($5, avatar),
       gender = COALESCE($6, gender),
       age = COALESCE($7, age),
       status_text = COALESCE($8, status_text),
       background_image = COALESCE($9, background_image),
       updated_at = now()
     WHERE user_id = $1
     RETURNING user_id, nickname, signature, email, avatar, gender, age, status_text, background_image`,
    [
      userId,
      profile.nickname,
      profile.signature,
      profile.email,
      profile.avatar,
      profile.gender,
      profile.age === "" || profile.age === undefined ? null : profile.age,
      profile.statusText ?? null,
      profile.backgroundImage ?? null
    ]
  );
  return rowToProfile(result.rows[0]);
}

export async function getBootstrap(userId) {
  const [profileResult, artistsResult, friendsResult, selfResult, fanResult, idolResult] = await Promise.all([
    query("SELECT user_id, nickname, signature, email, avatar, gender, age, status_text, background_image FROM profiles WHERE user_id = $1", [userId]),
    query("SELECT * FROM artists ORDER BY id"),
    query(
      `SELECT artists.* FROM artist_friends
       JOIN artists ON artists.id = artist_friends.artist_id
       WHERE artist_friends.user_id = $1
       ORDER BY artist_friends.created_at DESC`,
      [userId]
    ),
    query("SELECT * FROM self_messages WHERE user_id = $1 ORDER BY created_at ASC LIMIT 200", [userId]),
    query("SELECT * FROM fan_messages WHERE user_id = $1 ORDER BY created_at ASC LIMIT 300", [userId]),
    query("SELECT * FROM idol_chat_messages WHERE user_id = $1 ORDER BY created_at ASC LIMIT 500", [userId])
  ]);

  const idolThreads = new Map();
  for (const row of idolResult.rows) {
    if (!idolThreads.has(row.artist_id)) {
      idolThreads.set(row.artist_id, { artistId: row.artist_id, messages: [] });
    }
    idolThreads.get(row.artist_id).messages.push(rowToIdolChatMessage(row));
  }

  return {
    profile: rowToProfile(profileResult.rows[0]),
    recommendedArtists: artistsResult.rows.map(rowToArtist),
    addedArtists: friendsResult.rows.map(rowToArtist),
    selfMessages: selfResult.rows.map(rowToSelfMessage),
    fanMessages: fanResult.rows.map(rowToFanMessage),
    idolThreads: Array.from(idolThreads.values())
  };
}

export async function addArtistFriend(userId, artistId) {
  await query(
    `INSERT INTO artist_friends (user_id, artist_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, artist_id) DO NOTHING`,
    [userId, artistId]
  );
  const result = await query("SELECT * FROM artists WHERE id = $1", [artistId]);
  return rowToArtist(result.rows[0]);
}

export async function removeArtistFriend(userId, artistId) {
  await query("DELETE FROM artist_friends WHERE user_id = $1 AND artist_id = $2", [userId, artistId]);
}

export async function createSelfMessage(userId, message) {
  const result = await query(
    `INSERT INTO self_messages (id, user_id, text, status, display_time, sent_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $4 = 'sent' THEN now() ELSE NULL END)
     ON CONFLICT (id) DO UPDATE SET
       text = EXCLUDED.text,
       status = EXCLUDED.status,
       display_time = EXCLUDED.display_time,
       sent_at = COALESCE(self_messages.sent_at, EXCLUDED.sent_at)
     RETURNING *`,
    [message.id, userId, message.text, message.status || "pending", message.createdAt || null]
  );
  return rowToSelfMessage(result.rows[0]);
}

export async function updateSelfMessageStatus(userId, messageId, status) {
  const result = await query(
    `UPDATE self_messages SET
       status = $3,
       sent_at = CASE WHEN $3 = 'sent' THEN COALESCE(sent_at, now()) ELSE sent_at END
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    [userId, messageId, status]
  );
  return rowToSelfMessage(result.rows[0]);
}

export async function findSelfMessage(userId, messageId) {
  if (!messageId) return null;
  const result = await query(
    "SELECT * FROM self_messages WHERE user_id = $1 AND id = $2",
    [userId, messageId]
  );
  return result.rows[0] ? rowToSelfMessage(result.rows[0]) : null;
}

export async function createFanMessages(userId, messages, fromSelfMessageId) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const safeFromSelfMessageId = fromSelfMessageId
    ? (await findSelfMessage(userId, fromSelfMessageId) ? fromSelfMessageId : null)
    : null;

  return transaction(async (client) => {
    const saved = [];
    for (const message of messages) {
      const result = await client.query(
        `INSERT INTO fan_messages (
           id, user_id, from_self_message_id, fan_name, avatar, language,
           content, translated_content, persona_type, message_kind
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           content = EXCLUDED.content,
           translated_content = EXCLUDED.translated_content
         RETURNING *`,
        [
          message.id,
          userId,
          safeFromSelfMessageId,
          message.fanName,
          message.avatar,
          message.language,
          message.content,
          message.translatedContent,
          message.personaType || null,
          message.messageKind || null
        ]
      );
      saved.push(rowToFanMessage(result.rows[0]));
    }
    return saved;
  });
}

export async function listFanMessages(userId, limit = 200) {
  const result = await query(
    "SELECT * FROM fan_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [userId, Math.max(1, Math.min(Number(limit || 200), 500))]
  );
  return result.rows.reverse().map(rowToFanMessage);
}

export async function createIdolChatMessage(userId, artistId, message) {
  const result = await query(
    `INSERT INTO idol_chat_messages (id, user_id, artist_id, sender, text, display_time)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [message.id, userId, artistId, message.sender || "user", message.text, message.createdAt || null]
  );
  return result.rows[0] ? rowToIdolChatMessage(result.rows[0]) : message;
}

export async function createAiGenerationJob({ userId, operation, provider, model, sourceMessageId, requestPayload }) {
  const result = await query(
    `INSERT INTO ai_generation_jobs (user_id, operation, provider, model, source_message_id, request_payload)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId || null, operation, provider, model, sourceMessageId || null, requestPayload || {}]
  );
  return result.rows[0]?.id;
}

export async function finishAiGenerationJob(jobId, { status, responsePayload, errorMessage, durationMs }) {
  if (!jobId) return;
  await query(
    `UPDATE ai_generation_jobs SET
       status = $2,
       response_payload = COALESCE($3, '{}'::jsonb),
       error_message = $4,
       duration_ms = $5,
       completed_at = now()
     WHERE id = $1`,
    [jobId, status, responsePayload || {}, errorMessage || null, durationMs || null]
  );
}

// ── reaction_cache ────────────────────────────────────────────────────────────

/**
 * 查询 reaction_cache 里某条消息的缓存状态。
 * 返回 null 表示不存在（需要新建），否则返回 { status, result }。
 */
export async function getReactionCache(messageId) {
  const result = await query(
    "SELECT status, result_json FROM reaction_cache WHERE message_id = $1",
    [String(messageId)]
  );
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    status: row.status,
    result: row.result_json || null
  };
}

/**
 * 创建一条 processing 状态的 reaction_cache 记录。
 * 用 ON CONFLICT DO NOTHING 防止并发重复插入。
 * 返回 true 表示成功占位（本进程负责生成），false 表示已被其他进程占位。
 */
export async function createReactionCacheSlot(messageId) {
  const now = Date.now();
  const result = await query(
    `INSERT INTO reaction_cache (message_id, status, created_at, updated_at)
     VALUES ($1, 'processing', $2, $2)
     ON CONFLICT (message_id) DO NOTHING
     RETURNING message_id`,
    [String(messageId), now]
  );
  return result.rows.length > 0;
}

/**
 * 将 reaction_cache 记录更新为 done，写入结果 JSON。
 */
export async function finishReactionCache(messageId, fanMessages) {
  const now = Date.now();
  await query(
    `UPDATE reaction_cache
     SET status = 'done',
         result_json = $2,
         updated_at = $3
     WHERE message_id = $1`,
    [String(messageId), JSON.stringify({ fanMessages }), now]
  );
}

/**
 * 将 reaction_cache 记录更新为 failed。
 */
export async function failReactionCache(messageId) {
  const now = Date.now();
  await query(
    `UPDATE reaction_cache
     SET status = 'failed',
         updated_at = $2
     WHERE message_id = $1`,
    [String(messageId), now]
  );
}

/**
 * 清理超过 TTL（默认 2 小时）的 reaction_cache 记录。
 * 在 index.mjs 里定期调用，防止表无限增长。
 */
export async function cleanReactionCache(ttlMs = 2 * 60 * 60 * 1000) {
  const cutoff = Date.now() - ttlMs;
  await query(
    "DELETE FROM reaction_cache WHERE created_at < $1",
    [cutoff]
  );
}

// ── user_memories ─────────────────────────────────────────────────────────────

/**
 * 插入一条记忆，若 hash 已存在则更新 importance / last_seen_at / content。
 * hash = SHA-256(userId + ':' + normalizedContent)，由调用方传入。
 * 返回 true 表示新插入，false 表示已存在并更新。
 */
export async function insertOrUpdateMemory({
  id, userId, memoryType, content, importance,
  sourceMessageId, sourcePreview, hash, now
}) {
  const result = await query(
    `INSERT INTO user_memories
       (id, user_id, memory_type, content, importance,
        source_message_id, source_preview, hash,
        last_seen_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
     ON CONFLICT (hash) DO UPDATE
       SET importance    = GREATEST(user_memories.importance, EXCLUDED.importance),
           content       = EXCLUDED.content,
           last_seen_at  = EXCLUDED.last_seen_at
     RETURNING (xmax = 0) AS inserted`,
    [id, userId, memoryType, content, importance,
     sourceMessageId || null, sourcePreview || null, hash, now]
  );
  return result.rows[0]?.inserted === true;
}

/**
 * 按策略为 reaction-burst 选取候选记忆（最多 3 条）。
 * 策略：高重要度 → 最新 → 久未提及，过滤 archived / user_suppressed。
 */
export async function pickMemoriesForGeneration(userId) {
  const result = await query(
    `SELECT id, memory_type, content, importance, mention_count, last_mentioned_at
     FROM user_memories
     WHERE user_id = $1
       AND archived = false
       AND user_suppressed = false
     ORDER BY
       importance DESC,
       last_mentioned_at NULLS FIRST,
       last_seen_at DESC
     LIMIT 3`,
    [userId]
  );
  return result.rows;
}

/**
 * 更新被实际使用的记忆的 mention_count 和 last_mentioned_at。
 */
export async function updateMemoryMentioned(memoryIds, now) {
  if (!memoryIds || memoryIds.length === 0) return;
  await query(
    `UPDATE user_memories
     SET mention_count     = mention_count + 1,
         last_mentioned_at = $2
     WHERE id = ANY($1::text[])`,
    [memoryIds, now]
  );
}

/**
 * 列出用户所有未归档记忆（管理页用）。
 */
export async function listMemories(userId) {
  const result = await query(
    `SELECT id, memory_type, content, importance,
            mention_count, last_mentioned_at, user_suppressed, created_at
     FROM user_memories
     WHERE user_id = $1
       AND archived = false
     ORDER BY importance DESC, created_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * 用户设置"不再提起"某条记忆。
 */
export async function suppressMemory(userId, memoryId) {
  await query(
    `UPDATE user_memories
     SET user_suppressed = true
     WHERE id = $1 AND user_id = $2`,
    [memoryId, userId]
  );
}

/**
 * 用户物理删除某条记忆（永久不再使用）。
 */
export async function deleteMemory(userId, memoryId) {
  await query(
    `DELETE FROM user_memories
     WHERE id = $1 AND user_id = $2`,
    [memoryId, userId]
  );
}

/**
 * 归档过期记忆：
 * - emotion 类型：7 天未 last_seen_at
 * - 其他类型：importance <= 2 且 30 天未 last_seen_at
 */
export async function archiveStaleMemories() {
  const now = Date.now();
  const day7 = now - 7 * 24 * 60 * 60 * 1000;
  const day30 = now - 30 * 24 * 60 * 60 * 1000;
  await query(
    `UPDATE user_memories
     SET archived = true
     WHERE archived = false
       AND (
         (memory_type = 'emotion' AND last_seen_at < $1)
         OR
         (memory_type != 'emotion' AND importance <= 2 AND last_seen_at < $2)
       )`,
    [day7, day30]
  );
}

// ── history_messages ──────────────────────────────────────────────────────────

/**
 * 从 history_messages 表随机采样，用于 burst 效果。
 * 使用 random_key 列做 ORDER BY random() 的廉价替代，避免全表扫描。
 * 每次调用后更新 used_count 和 last_used_at，便于后续分析。
 */
export async function pickHistoryMessages(count = 14) {
  const safeCount = Math.max(1, Math.min(Number(count) || 14, 50));

  const result = await query(
    `SELECT * FROM history_messages
     WHERE safety_level = 'safe'
     ORDER BY random_key
     LIMIT $1`,
    [safeCount * 3] // 多取一些再在应用层 shuffle，避免每次顺序相同
  );

  if (result.rows.length === 0) return [];

  // Fisher-Yates shuffle，然后取前 safeCount 条
  const rows = result.rows;
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  const picked = rows.slice(0, safeCount);

  // 异步更新使用统计，不阻塞响应
  const ids = picked.map((row) => row.id);
  query(
    `UPDATE history_messages
     SET used_count = used_count + 1,
         last_used_at = $2,
         random_key = random()
     WHERE id = ANY($1::text[])`,
    [ids, Date.now()]
  ).catch(() => {/* 统计失败不影响主流程 */});

  return picked.map((row) => ({
    id: `history-${row.id}-${Date.now()}`,
    fanName: row.fan_name || "fan",
    avatar: row.avatar || "🐰",
    language: row.language || "zh",
    content: row.content,
    translatedContent: row.translated_content || row.content,
    personaType: row.persona_type || undefined,
    messageKind: "ambient"
  }));
}

// ── idol_growth_stats ─────────────────────────────────────────────────────────

function rowToGrowthStats(row) {
  if (!row) return null;
  return {
    dailyBusinessValue: row.daily_business_value ?? 0,
    maxDailyBusinessValue: 100,
    followers: row.followers ?? 0,
    totalEcho: row.total_echo ?? 0,
    streakDays: row.streak_days ?? 0,
    inactiveDays: row.inactive_days ?? 0,
    lastActiveDate: row.last_active_date ?? null,
    lastSettlementDate: row.last_settlement_date ?? null,
    createdDate: row.created_date ?? null,
    initialFollowers: row.initial_followers ?? 0,
    unlockedAchievements: JSON.parse(row.unlocked_achievements || "[]"),
    unlockedPersonas: JSON.parse(row.unlocked_personas || "[]")
  };
}

/**
 * 获取用户成长数据，不存在则自动初始化。
 */
export async function getOrCreateGrowthStats(userId) {
  const { todayCST } = await import("./growthEngine.mjs");
  const today = todayCST();

  const INITIAL_FOLLOWERS = 1000;

  const result = await query(
    `INSERT INTO idol_growth_stats (user_id, followers, initial_followers, created_date, updated_at)
     VALUES ($1, $2, $2, $3, $4)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [userId, INITIAL_FOLLOWERS, today, Date.now()]
  );

  if (result.rows.length > 0) return rowToGrowthStats(result.rows[0]);

  const sel = await query(
    `SELECT * FROM idol_growth_stats WHERE user_id = $1`,
    [userId]
  );
  return rowToGrowthStats(sel.rows[0] ?? null);
}

/**
 * 增加营业值（不超过上限 100）。
 * 同时更新 last_active_date（用于连续营业判断）。
 * @param {string} userId
 * @param {number} delta
 * @param {string} today - YYYY-MM-DD
 * @returns {object} 更新后的 growthStats
 */
export async function addBusinessValue(userId, delta, today) {
  const result = await query(
    `UPDATE idol_growth_stats
     SET daily_business_value = LEAST(daily_business_value + $2, 100),
         last_active_date      = $3,
         updated_at            = $4
     WHERE user_id = $1
     RETURNING *`,
    [userId, delta, today, Date.now()]
  );
  return rowToGrowthStats(result.rows[0] ?? null);
}

/**
 * 将每日结算 patch 写入数据库。
 * patch 字段为 camelCase，此函数负责转换。
 */
export async function applyGrowthSettlement(userId, patch) {
  if (!patch || Object.keys(patch).length === 0) return;
  await query(
    `UPDATE idol_growth_stats
     SET followers              = $2,
         streak_days            = $3,
         inactive_days          = $4,
         total_echo             = $5,
         daily_business_value   = $6,
         last_settlement_date   = $7,
         unlocked_achievements  = $8,
         updated_at             = $9
     WHERE user_id = $1`,
    [
      userId,
      patch.followers,
      patch.streakDays,
      patch.inactiveDays,
      patch.totalEcho,
      patch.dailyBusinessValue,
      patch.lastSettlementDate,
      patch.unlockedAchievements,
      patch.updatedAt
    ]
  );
}

/**
 * 每日结算定时任务：对所有用户执行结算。
 * 在 index.mjs 的 setInterval 中调用。
 */
export async function runDailySettlementForAll() {
  const { settleDailyGrowth } = await import("./growthEngine.mjs");
  const result = await query(`SELECT * FROM idol_growth_stats`);
  for (const row of result.rows) {
    const stats = rowToGrowthStats(row);
    const { patch } = settleDailyGrowth(stats);
    if (Object.keys(patch).length > 0) {
      await applyGrowthSettlement(row.user_id, patch).catch(() => {});
    }
  }
}
