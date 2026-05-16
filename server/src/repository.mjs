import { query, transaction } from "./db.mjs";
import { isMessageAllowedForTime } from "./timeContext.mjs";

function rowToProfile(row) {
  if (!row) return null;
  return {
    id: row.user_id,
    nickname: row.nickname,
    signature: row.signature,
    email: row.email,
    avatar: row.avatar,
    gender: row.gender || "female",
    age: row.age ?? null,
    statusText: row.status_text ?? undefined,
    backgroundImage: row.background_image ?? undefined,
    fanName: row.fan_name ?? undefined
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
    type: row.message_type || "text",
    poll: row.poll || undefined,
    status: row.status,
    createdAt: row.display_time || formatTime(row.created_at),
    attachmentType: row.attachment_type || undefined,
    attachmentUri: row.attachment_uri || undefined,
    imageCaption: row.image_caption || undefined
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
    createdAt: row.display_time || formatTime(row.created_at),
    attachmentType: row.attachment_type || undefined,
    attachmentUri: row.attachment_uri || undefined
  };
}

function rowToEntitlement(row) {
  if (!row) {
    return {
      plan: "free",
      status: "active",
      startedAt: null,
      expiresAt: null,
      source: null
    };
  }
  return {
    plan: row.plan || "free",
    status: row.status || "active",
    startedAt: row.started_at ?? null,
    expiresAt: row.expires_at ?? null,
    source: row.source ?? null
  };
}

function rowToPreferences(row) {
  return {
    fanNotificationsEnabled: Boolean(row?.fan_notifications_enabled),
    autoTranslateEnabled: Boolean(row?.auto_translate_enabled)
  };
}

function ossObjectKeyFromUrl(value) {
  if (!value || typeof value !== "string") return "";
  if (!value.includes("/uploads/")) return "";
  try {
    const url = new URL(value);
    return url.pathname.replace(/^\/+/, "");
  } catch {
    const index = value.indexOf("uploads/");
    return index >= 0 ? value.slice(index).split("?")[0] : "";
  }
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
       RETURNING user_id, nickname, signature, email, avatar, gender, age, status_text, background_image, fan_name`,
      [user.id]
    );

    let profile = profileResult.rows[0];
    if (!profile) {
      const existingProfile = await client.query(
        "SELECT user_id, nickname, signature, email, avatar, gender, age, status_text, background_image, fan_name FROM profiles WHERE user_id = $1",
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

export async function getUserAccount(userId) {
  const [userResult, profileResult, entitlementResult, preferencesResult] = await Promise.all([
    query(
      `SELECT id, auth_provider, email_hash, email_encrypted, email_masked, role, is_email_verified,
              created_at, updated_at, deleted_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    ),
    query("SELECT user_id, nickname, signature, email, avatar, gender, age, status_text, background_image, fan_name FROM profiles WHERE user_id = $1", [userId]),
    query("SELECT * FROM user_entitlements WHERE user_id = $1", [userId]),
    query("SELECT * FROM user_preferences WHERE user_id = $1", [userId])
  ]);

  const user = userResult.rows[0];
  if (!user) return null;
  return {
    user,
    profile: rowToProfile(profileResult.rows[0]),
    entitlement: rowToEntitlement(entitlementResult.rows[0]),
    preferences: rowToPreferences(preferencesResult.rows[0])
  };
}

export async function createEmailCodeRecord({ id, emailHash, codeHash, purpose, ipHash, expiresAt, createdAt }) {
  await query(
    `INSERT INTO email_codes
       (id, email_hash, code_hash, purpose, ip_hash, expires_at, created_at)
     VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::bigint, $7::bigint)`,
    [id, emailHash, codeHash, purpose, ipHash, expiresAt, createdAt]
  );
}

export async function getEmailRateStats({ emailHash, ipHash, now }) {
  const emailCooldownAfter = now - 60_000;
  const dayAfter = now - 24 * 60 * 60 * 1000;
  const hourAfter = now - 60 * 60 * 1000;
  const [cooldown, daily, hourlyIp] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM email_codes WHERE email_hash = $1::text AND created_at > $2::bigint", [emailHash, emailCooldownAfter]),
    query("SELECT COUNT(*)::int AS count FROM email_codes WHERE email_hash = $1::text AND created_at > $2::bigint", [emailHash, dayAfter]),
    query("SELECT COUNT(*)::int AS count FROM email_codes WHERE ip_hash = $1::text AND created_at > $2::bigint", [ipHash, hourAfter])
  ]);
  return {
    emailCooldownCount: Number(cooldown.rows[0]?.count || 0),
    emailDailyCount: Number(daily.rows[0]?.count || 0),
    ipHourlyCount: Number(hourlyIp.rows[0]?.count || 0)
  };
}

export async function verifyEmailLoginCode({ emailHash, codeHash, purpose, now }) {
  return transaction(async (client) => {
    const result = await client.query(
      `SELECT *
       FROM email_codes
       WHERE email_hash = $1::text
         AND purpose = $2::text
         AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [emailHash, purpose]
    );
    const code = result.rows[0];
    if (!code) {
      return { ok: false, reason: "验证码不存在或已使用。" };
    }
    if (Number(code.expires_at) <= now) {
      return { ok: false, reason: "验证码已过期。" };
    }
    if (Number(code.attempt_count || 0) >= 5) {
      return { ok: false, reason: "验证码尝试次数过多，请重新获取。" };
    }
    if (code.code_hash !== codeHash) {
      await client.query(
        "UPDATE email_codes SET attempt_count = attempt_count + 1 WHERE id = $1::text",
        [code.id]
      );
      return { ok: false, reason: "验证码不正确。" };
    }

    await client.query(
      "UPDATE email_codes SET consumed_at = $2::bigint WHERE id = $1::text",
      [code.id, now]
    );
    return { ok: true };
  });
}

async function ensureEntitlement(client, userId, now) {
  await client.query(
    `INSERT INTO user_entitlements (user_id, plan, status, started_at, source, updated_at)
     VALUES ($1::uuid, 'free', 'active', $2::bigint, 'system', $2::bigint)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, now]
  );
}

async function mergeGuestProfile(client, guestUserId, targetUserId) {
  const guestProfile = await client.query(
    "SELECT * FROM profiles WHERE user_id = $1::uuid",
    [guestUserId]
  );
  if (!guestProfile.rows[0]) return;
  await client.query(
     `INSERT INTO profiles
       (user_id, nickname, signature, email, avatar, gender, age, status_text, background_image, fan_name)
     VALUES ($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::integer, $8::text, $9::text, $10::text)
     ON CONFLICT (user_id) DO UPDATE SET
       nickname = EXCLUDED.nickname,
       signature = EXCLUDED.signature,
       avatar = EXCLUDED.avatar,
       gender = EXCLUDED.gender,
       age = EXCLUDED.age,
       status_text = EXCLUDED.status_text,
       background_image = EXCLUDED.background_image,
       fan_name = EXCLUDED.fan_name,
       updated_at = now()`,
    [
      targetUserId,
      guestProfile.rows[0].nickname,
      guestProfile.rows[0].signature,
      guestProfile.rows[0].email || "",
      guestProfile.rows[0].avatar,
      guestProfile.rows[0].gender,
      guestProfile.rows[0].age,
      guestProfile.rows[0].status_text,
      guestProfile.rows[0].background_image,
      guestProfile.rows[0].fan_name
    ]
  );
}

export async function findOrCreateEmailUserAndMigrateGuest({ emailHash, emailEncrypted, emailMasked, guestUserId, now }) {
  return transaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM users
       WHERE email_hash = $1::text AND deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [emailHash]
    );

    let userId = existing.rows[0]?.id;
    if (!userId) {
      const created = await client.query(
        `INSERT INTO users
           (auth_provider, email_hash, email_encrypted, email_masked, is_email_verified, role, last_seen_at, updated_at)
         VALUES ('email', $1::text, $2::text, $3::text, true, 'user', now(), now())
         RETURNING id`,
        [emailHash, emailEncrypted, emailMasked]
      );
      userId = created.rows[0].id;
      await client.query("INSERT INTO profiles (user_id) VALUES ($1::uuid) ON CONFLICT (user_id) DO NOTHING", [userId]);
    } else {
      await client.query(
        `UPDATE users
         SET email_encrypted = $2::text,
             email_masked = $3::text,
             is_email_verified = true,
             auth_provider = CASE WHEN auth_provider = 'device' THEN 'email' ELSE auth_provider END,
             last_seen_at = now(),
             updated_at = now()
         WHERE id = $1::uuid`,
        [userId, emailEncrypted, emailMasked]
      );
      await client.query("INSERT INTO profiles (user_id) VALUES ($1::uuid) ON CONFLICT (user_id) DO NOTHING", [userId]);
    }

    await ensureEntitlement(client, userId, now);

    if (guestUserId && String(guestUserId) !== String(userId)) {
      await mergeGuestProfile(client, guestUserId, userId);

      await client.query(
        `INSERT INTO artist_friends (user_id, artist_id, created_at)
         SELECT $2::uuid, artist_id, created_at FROM artist_friends WHERE user_id = $1::uuid
         ON CONFLICT (user_id, artist_id) DO NOTHING`,
        [guestUserId, userId]
      );
      await client.query("DELETE FROM artist_friends WHERE user_id = $1::uuid", [guestUserId]);

      await client.query("UPDATE self_messages SET user_id = $2::uuid WHERE user_id = $1::uuid", [guestUserId, userId]);
      await client.query("UPDATE fan_messages SET user_id = $2::uuid WHERE user_id = $1::uuid", [guestUserId, userId]);
      await client.query("UPDATE idol_chat_messages SET user_id = $2::uuid WHERE user_id = $1::uuid", [guestUserId, userId]);
      await client.query("UPDATE ai_generation_jobs SET user_id = $2::uuid WHERE user_id = $1::uuid", [guestUserId, userId]);
      await client.query("UPDATE user_memories SET user_id = $2::text WHERE user_id = $1::text", [guestUserId, userId]);

      const guestGrowth = await client.query("SELECT * FROM idol_growth_stats WHERE user_id = $1::text", [guestUserId]);
      if (guestGrowth.rows[0]) {
        await client.query(
          `INSERT INTO idol_growth_stats
             (user_id, daily_business_value, followers, total_echo, streak_days, inactive_days,
              last_active_date, last_settlement_date, created_date, unlocked_achievements,
              unlocked_personas, initial_followers, updated_at)
           VALUES
             ($1::text, $2::integer, $3::integer, $4::integer, $5::integer, $6::integer,
              $7::text, $8::text, $9::text, $10::text, $11::text, $12::integer, $13::bigint)
           ON CONFLICT (user_id) DO UPDATE SET
             daily_business_value = GREATEST(idol_growth_stats.daily_business_value, EXCLUDED.daily_business_value),
             followers = GREATEST(idol_growth_stats.followers, EXCLUDED.followers),
             total_echo = GREATEST(idol_growth_stats.total_echo, EXCLUDED.total_echo),
             streak_days = GREATEST(idol_growth_stats.streak_days, EXCLUDED.streak_days),
             inactive_days = LEAST(idol_growth_stats.inactive_days, EXCLUDED.inactive_days),
             last_active_date = COALESCE(EXCLUDED.last_active_date, idol_growth_stats.last_active_date),
             last_settlement_date = COALESCE(EXCLUDED.last_settlement_date, idol_growth_stats.last_settlement_date),
             unlocked_achievements = EXCLUDED.unlocked_achievements,
             unlocked_personas = EXCLUDED.unlocked_personas,
             initial_followers = GREATEST(idol_growth_stats.initial_followers, EXCLUDED.initial_followers),
             updated_at = GREATEST(idol_growth_stats.updated_at, EXCLUDED.updated_at)`,
          [
            userId,
            guestGrowth.rows[0].daily_business_value,
            guestGrowth.rows[0].followers,
            guestGrowth.rows[0].total_echo,
            guestGrowth.rows[0].streak_days,
            guestGrowth.rows[0].inactive_days,
            guestGrowth.rows[0].last_active_date,
            guestGrowth.rows[0].last_settlement_date,
            guestGrowth.rows[0].created_date,
            guestGrowth.rows[0].unlocked_achievements,
            guestGrowth.rows[0].unlocked_personas,
            guestGrowth.rows[0].initial_followers,
            guestGrowth.rows[0].updated_at
          ]
        );
        await client.query("DELETE FROM idol_growth_stats WHERE user_id = $1::text", [guestUserId]);
      }

      await client.query("UPDATE device_sessions SET revoked_at = now() WHERE user_id = $1::uuid AND revoked_at IS NULL", [guestUserId]);
      await client.query(
        `UPDATE users
         SET deleted_at = $2::bigint,
             device_id = NULL,
             phone = NULL,
             email = NULL,
             apple_sub = NULL,
             updated_at = now()
         WHERE id = $1::uuid AND email_hash IS NULL`,
        [guestUserId, now]
      );
    }

    const account = await client.query(
      `SELECT id, auth_provider, email_hash, email_encrypted, email_masked, role, is_email_verified,
              created_at, updated_at, deleted_at
       FROM users
       WHERE id = $1::uuid`,
      [userId]
    );
    const profile = await client.query(
      "SELECT user_id, nickname, signature, email, avatar, gender, age, status_text, background_image, fan_name FROM profiles WHERE user_id = $1::uuid",
      [userId]
    );
    const entitlement = await client.query("SELECT * FROM user_entitlements WHERE user_id = $1::uuid", [userId]);
    return {
      user: account.rows[0],
      profile: rowToProfile(profile.rows[0]),
      entitlement: rowToEntitlement(entitlement.rows[0])
    };
  });
}

export async function anonymizeUserAccount(userId, now) {
  return transaction(async (client) => {
    const objectKeys = new Set();
    const profileAssets = await client.query(
      "SELECT avatar, background_image FROM profiles WHERE user_id = $1",
      [userId]
    );
    for (const value of [profileAssets.rows[0]?.avatar, profileAssets.rows[0]?.background_image]) {
      const objectKey = ossObjectKeyFromUrl(value);
      if (objectKey) objectKeys.add(objectKey);
    }
    const messageAssets = await client.query(
      `SELECT attachment_uri FROM self_messages WHERE user_id = $1 AND attachment_uri IS NOT NULL
       UNION
       SELECT attachment_uri FROM idol_chat_messages WHERE user_id = $1 AND attachment_uri IS NOT NULL`,
      [userId]
    );
    for (const row of messageAssets.rows) {
      const objectKey = ossObjectKeyFromUrl(row.attachment_uri);
      if (objectKey) objectKeys.add(objectKey);
    }

    for (const objectKey of objectKeys) {
      await client.query(
        `INSERT INTO oss_deletion_queue (user_id, object_key, source, status, created_at)
         VALUES ($1, $2, 'account_deletion', 'pending', $3)`,
        [userId, objectKey, now]
      );
    }

    await client.query("UPDATE device_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
    await client.query("DELETE FROM fan_messages WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM self_messages WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM idol_chat_messages WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM ai_generation_jobs WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM user_memories WHERE user_id = $1::text", [String(userId)]);
    await client.query("DELETE FROM idol_growth_stats WHERE user_id = $1::text", [String(userId)]);
    await client.query("DELETE FROM artist_friends WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM usage_quotas WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM user_preferences WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM user_entitlements WHERE user_id = $1", [userId]);
    await client.query(
      `UPDATE profiles
       SET nickname = '已注销用户',
           signature = '',
           email = '',
           avatar = 'IM',
           status_text = NULL,
           background_image = NULL,
           fan_name = NULL,
           updated_at = now()
       WHERE user_id = $1`,
      [userId]
    );
    await client.query(
      `UPDATE users
       SET email_hash = NULL,
           email_encrypted = NULL,
           email_masked = NULL,
           phone = NULL,
           email = NULL,
           apple_sub = NULL,
           device_id = NULL,
           is_email_verified = false,
           deleted_at = $2,
           updated_at = now()
       WHERE id = $1`,
      [userId, now]
    );
  });
}

export async function getUserPreferences(userId) {
  const result = await query("SELECT * FROM user_preferences WHERE user_id = $1", [userId]);
  return rowToPreferences(result.rows[0]);
}

export async function updateUserPreferences(userId, preferences = {}) {
  const current = await getUserPreferences(userId);
  const fanNotificationsEnabled = Object.prototype.hasOwnProperty.call(preferences, "fanNotificationsEnabled")
    ? Boolean(preferences.fanNotificationsEnabled)
    : current.fanNotificationsEnabled;
  const autoTranslateEnabled = Object.prototype.hasOwnProperty.call(preferences, "autoTranslateEnabled")
    ? Boolean(preferences.autoTranslateEnabled)
    : current.autoTranslateEnabled;
  const result = await query(
    `INSERT INTO user_preferences (user_id, fan_notifications_enabled, auto_translate_enabled, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       fan_notifications_enabled = EXCLUDED.fan_notifications_enabled,
       auto_translate_enabled = EXCLUDED.auto_translate_enabled,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [userId, fanNotificationsEnabled, autoTranslateEnabled, Date.now()]
  );
  return rowToPreferences(result.rows[0]);
}

export async function updateProfile(userId, profile) {
  const hasFanName = Object.prototype.hasOwnProperty.call(profile, "fanName");
  const rawFanName = profile.fanName;
  let cleanFanName = null;
  if (typeof rawFanName === "string" && rawFanName.length > 0) {
    let cleaned = rawFanName.trim().replace(/^@+/, "").replace(/\s+/g, " ").trim();
    cleaned = cleaned.replace(/[\r\n]/g, "");
    if (cleaned.length > 0) {
      cleanFanName = cleaned.slice(0, 24);
    }
  }

  const result = await query(
    `UPDATE profiles SET
       nickname = COALESCE($2, nickname),
       signature = COALESCE($3, signature),
       email = COALESCE($4, email),
       avatar = COALESCE($5, avatar),
       gender = COALESCE($6, gender),
       age = COALESCE($7, age),
       status_text = COALESCE($8, status_text),
       background_image = $9,
       fan_name = CASE WHEN $10::boolean THEN $11::text ELSE fan_name END,
       updated_at = now()
     WHERE user_id = $1
     RETURNING user_id, nickname, signature, email, avatar, gender, age, status_text, background_image, fan_name`,
    [
      userId,
      profile.nickname,
      profile.signature,
      profile.email,
      profile.avatar,
      profile.gender,
      profile.age === "" || profile.age === undefined ? null : profile.age,
      profile.statusText ?? null,
      profile.backgroundImage ?? null,
      hasFanName,
      cleanFanName
    ]
  );
  return rowToProfile(result.rows[0]);
}

export async function getBootstrap(userId) {
  const [profileResult, artistsResult, friendsResult, selfResult, fanResult, idolResult] = await Promise.all([
    query("SELECT user_id, nickname, signature, email, avatar, gender, age, status_text, background_image, fan_name FROM profiles WHERE user_id = $1", [userId]),
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
    `INSERT INTO self_messages (id, user_id, text, message_type, poll, status, display_time, sent_at, attachment_type, attachment_uri, image_caption)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $6 = 'sent' THEN now() ELSE NULL END, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       text = EXCLUDED.text,
       message_type = EXCLUDED.message_type,
       poll = EXCLUDED.poll,
       status = EXCLUDED.status,
       display_time = EXCLUDED.display_time,
       sent_at = COALESCE(self_messages.sent_at, EXCLUDED.sent_at),
       attachment_type = EXCLUDED.attachment_type,
       attachment_uri = EXCLUDED.attachment_uri,
       image_caption = EXCLUDED.image_caption
     RETURNING *`,
    [
      message.id,
      userId,
      message.text,
      message.type || "text",
      message.poll || null,
      message.status || "pending",
      message.createdAt || null,
      message.attachmentType || null,
      message.attachmentUri || null,
      message.imageCaption || null
    ]
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

export async function countSentSelfMessagesForDate(userId, today) {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM self_messages
     WHERE user_id = $1
       AND status = 'sent'
       AND to_char(sent_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') = $2`,
    [userId, today]
  );
  return Number(result.rows[0]?.count || 0);
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
    `INSERT INTO idol_chat_messages (id, user_id, artist_id, sender, text, display_time, attachment_type, attachment_uri)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       text = EXCLUDED.text,
       display_time = EXCLUDED.display_time,
       attachment_type = EXCLUDED.attachment_type,
       attachment_uri = EXCLUDED.attachment_uri
     RETURNING *`,
    [
      message.id,
      userId,
      artistId,
      message.sender || "user",
      message.text,
      message.createdAt || null,
      message.attachmentType || null,
      message.attachmentUri || null
    ]
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
export async function pickHistoryMessages(count = 14, timeContext = {}) {
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
  const picked = rows
    .filter((row) => isMessageAllowedForTime({
      content: row.content,
      translatedContent: row.translated_content,
      personaType: row.persona_type
    }, timeContext))
    .slice(0, safeCount);

  if (picked.length === 0) return [];

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
  const result = await query(
    `SELECT gs.*, COALESCE(up.fan_notifications_enabled, false) AS fan_notifications_enabled
     FROM idol_growth_stats gs
     LEFT JOIN user_preferences up ON up.user_id::text = gs.user_id`
  );
  for (const row of result.rows) {
    const stats = rowToGrowthStats(row);
    const { patch } = settleDailyGrowth(stats, {
      followerLossEnabled: Boolean(row.fan_notifications_enabled)
    });
    if (Object.keys(patch).length > 0) {
      await applyGrowthSettlement(row.user_id, patch).catch(() => {});
    }
  }
}
