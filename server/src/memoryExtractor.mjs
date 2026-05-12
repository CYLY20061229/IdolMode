/**
 * memoryExtractor.mjs
 *
 * 从用户营业消息中 AI 抽取记忆，写入 user_memories 表。
 * 设计原则：
 *   - 失败静默，不影响主流程
 *   - 简单 hash 去重（SHA-256 of userId:normalizedContent）
 *   - 第一版不做 AI 合并，只做 hash 去重 + ON CONFLICT 更新
 *   - memory_type 只启用：preference / habit / life_event / creative_context / emotion
 *   - emotion 类型 importance 上限 3，7 天自动归档
 */

import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { getAiConfig } from "./aiClient.mjs";
import { isDbEnabled } from "./db.mjs";
import { insertOrUpdateMemory } from "./repository.mjs";

const VALID_TYPES = new Set(["preference", "habit", "life_event", "creative_context", "emotion"]);

// ── AI 抽取 system prompt ─────────────────────────────────────────────────────

function buildExtractionPrompt() {
  return `You are a memory extractor for an idol simulation app.
Given a message written by the user (who is roleplaying as an idol), extract up to 3 meaningful memories.

Rules:
- Only extract information that is genuinely meaningful and specific (life events, preferences, habits, creative context, emotions).
- Do NOT extract generic or trivial content (e.g. "user said hello", "user is online").
- memory_type must be one of: preference, habit, life_event, creative_context, emotion.
- content must be in Simplified Chinese, max 120 characters, written as a third-person description of the user.
- importance: integer 1-5. 5 = very significant. emotion type max importance is 3.
- If nothing meaningful can be extracted, return an empty array [].
- Return ONLY valid JSON array. No markdown, no explanation.

Example output:
[
  {"memory_type": "life_event", "content": "用户最近经历了期末考试，考完后感到疲惫，但仍坚持营业。", "importance": 4},
  {"memory_type": "preference", "content": "用户偏好热烈、发疯感的粉丝反馈，不希望出现攻击性语言。", "importance": 5}
]`;
}

// ── hash 工具 ─────────────────────────────────────────────────────────────────

function normalizeContent(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function memoryHash(userId, content) {
  return createHash("sha256")
    .update(`${userId}:${normalizeContent(content)}`)
    .digest("hex");
}

// ── AI 调用 ───────────────────────────────────────────────────────────────────

async function callExtractionAi(message) {
  const config = getAiConfig();
  if (!config.apiKey) return [];

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.3,   // 低温度，保证输出稳定
      max_tokens: 600,
      messages: [
        { role: "system", content: buildExtractionPrompt() },
        { role: "user", content: `用户营业消息：${String(message).slice(0, 300)}` }
      ]
    }),
    signal: AbortSignal.timeout(12_000)
  });

  if (!response.ok) return [];

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content || "";

  // 解析 JSON
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try { return JSON.parse(match[0]); } catch { return []; }
  }
}

// ── 主入口 ────────────────────────────────────────────────────────────────────

/**
 * 从营业消息中抽取记忆并写入数据库。
 * 异步调用，失败静默。
 *
 * @param {string} userId
 * @param {string} message  - 用户营业消息原文
 * @param {string} [sourceMessageId] - self_messages.id
 */
export async function extractAndSaveMemories(userId, message, sourceMessageId) {
  if (!isDbEnabled()) return;
  if (!userId || !message) return;

  try {
    const raw = await callExtractionAi(message);
    if (!raw.length) return;

    const now = Date.now();
    const sourcePreview = String(message).slice(0, 50);

    for (const item of raw.slice(0, 3)) {
      const memType = VALID_TYPES.has(item.memory_type) ? item.memory_type : null;
      if (!memType) continue;

      const content = String(item.content || "").trim().slice(0, 200);
      if (!content) continue;

      // emotion 类型 importance 上限 3
      let importance = Math.max(1, Math.min(5, Number(item.importance) || 3));
      if (memType === "emotion") importance = Math.min(importance, 3);

      const hash = memoryHash(userId, content);

      await insertOrUpdateMemory({
        id: randomUUID(),
        userId,
        memoryType: memType,
        content,
        importance,
        sourceMessageId: sourceMessageId || null,
        sourcePreview,
        hash,
        now
      });
    }
  } catch {
    // 静默失败，不影响主流程
  }
}

// ── 记忆注入 system prompt 片段 ───────────────────────────────────────────────

/**
 * 将候选记忆格式化为注入 reaction-burst system prompt 的文本片段。
 * 最多 3 条，每批粉丝消息最多 1 条可以自然提及记忆。
 *
 * @param {Array} memories - pickMemoriesForGeneration 返回的行
 * @returns {string}
 */
export function buildMemoryContext(memories) {
  if (!memories || memories.length === 0) return "";

  const lines = memories
    .slice(0, 3)
    .map((m, i) => `  ${i + 1}. [${m.memory_type}] ${m.content}`)
    .join("\n");

  return `
## User Memory Context (CONFIDENTIAL — do NOT quote directly)
The following are things the AI remembers about this user. You MAY let at most 1 fan message in this batch naturally reference one of these memories — only if it feels organic and warm, never robotic or data-like.
${lines}
Rules for memory usage:
- At most 1 fan message in the entire batch may reference a memory.
- The reference must feel like a real fan who noticed something, not like a system reading a database.
- Bad: "根据你的记忆，你最近考试很累。"
- Good: "考完还来营业，宝宝你真的别太硬撑了，今晚早点睡好吗。"
- Each fan message that uses a memory MUST include a "usedMemoryIds" field with the memory id(s) used. Others must include "usedMemoryIds": [].
- Memory ids: ${memories.slice(0, 3).map((m) => `"${m.id}"`).join(", ")}
`;
}
