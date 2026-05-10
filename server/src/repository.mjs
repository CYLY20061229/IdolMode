import { query, transaction } from "./db.mjs";

function rowToProfile(row) {
  if (!row) return null;
  return {
    id: row.user_id,
    nickname: row.nickname,
    signature: row.signature,
    email: row.email,
    avatar: row.avatar
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
    translatedContent: row.translated_content,
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

export function getUserId(req, body = {}) {
  return body.userId || req.headers["x-user-id"] || "";
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
       RETURNING user_id, nickname, signature, email, avatar`,
      [user.id]
    );

    let profile = profileResult.rows[0];
    if (!profile) {
      const existingProfile = await client.query(
        "SELECT user_id, nickname, signature, email, avatar FROM profiles WHERE user_id = $1",
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
       updated_at = now()
     WHERE user_id = $1
     RETURNING user_id, nickname, signature, email, avatar`,
    [userId, profile.nickname, profile.signature, profile.email, profile.avatar]
  );
  return rowToProfile(result.rows[0]);
}

export async function getBootstrap(userId) {
  const [profileResult, artistsResult, friendsResult, selfResult, fanResult, idolResult] = await Promise.all([
    query("SELECT user_id, nickname, signature, email, avatar FROM profiles WHERE user_id = $1", [userId]),
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

export async function createFanMessages(userId, messages, fromSelfMessageId) {
  if (!Array.isArray(messages) || messages.length === 0) return [];

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
          fromSelfMessageId || message.fromMessageId || null,
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
