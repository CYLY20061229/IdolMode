import {
  buildSystemPrompt,
  fallbackFanMessage,
  fallbackFanMessages,
  normalizeFanMessage
} from "./fanPersonas.mjs";
import { logAiFailure } from "./logger.mjs";

function extractJson(text) {
  const trimmed = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) throw new Error("AI response did not contain JSON.");
    return JSON.parse(match[0]);
  }
}

export function getAiConfig() {
  const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || process.env.DEEPSEEK_API_KEY;
  const baseUrl =
    process.env.QWEN_BASE_URL ||
    process.env.DASHSCOPE_BASE_URL ||
    process.env.DEEPSEEK_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = process.env.QWEN_MODEL || process.env.DASHSCOPE_MODEL || process.env.DEEPSEEK_MODEL || "qwen3.5-plus";
  const provider = process.env.AI_PROVIDER || (baseUrl.includes("dashscope") ? "qwen" : "openai-compatible");

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ""),
    model,
    provider,
    temperature: Number(process.env.QWEN_TEMPERATURE || process.env.AI_TEMPERATURE || process.env.DEEPSEEK_TEMPERATURE || 1.05),
    maxTokens: Number(process.env.QWEN_MAX_TOKENS || process.env.AI_MAX_TOKENS || process.env.DEEPSEEK_MAX_TOKENS || 900)
  };
}

async function postChatCompletion(payload, retryWithoutJsonMode = true) {
  const config = getAiConfig();
  if (!config.apiKey) {
    throw new Error("Missing QWEN_API_KEY or DASHSCOPE_API_KEY.");
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text();
    if (retryWithoutJsonMode && response.status === 400 && payload.response_format) {
      const { response_format: _responseFormat, ...retryPayload } = payload;
      return postChatCompletion(retryPayload, false);
    }
    throw new Error(`AI API failed with ${response.status}: ${detail}`);
  }

  return response.json();
}

async function callAi(userPrompt) {
  const config = getAiConfig();
  if (!config.apiKey) {
    throw new Error("Missing QWEN_API_KEY or DASHSCOPE_API_KEY.");
  }

  const data = await postChatCompletion({
    model: config.model,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: userPrompt }
    ],
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    response_format: { type: "json_object" },
    stream: false
  });

  return data?.choices?.[0]?.message?.content || "";
}

export async function generateFanMessages(message, count = 4) {
  try {
    const safeCount = Math.max(1, Math.min(Number(count || 4), 8));
    const content = await callAi(`The idol just sent this bubble update: "${String(message || "").slice(0, 400)}"
Generate ${safeCount} fan messages.
JSON shape:
{
  "fanMessages": [
    {
      "fanName": "short nickname",
      "avatar": "🐰",
      "personaType": "comfort guardian",
      "messageKind": "reaction",
      "language": "en",
      "content": "short original fan message",
      "translatedContent": "中文翻译"
    }
  ]
}`);
    const parsed = extractJson(content);
    const fanMessages = Array.isArray(parsed.fanMessages) ? parsed.fanMessages : [];
    const normalized = fanMessages.slice(0, safeCount).map((item, index) => normalizeFanMessage(item, index, "reaction"));
    return normalized.length ? normalized : fallbackFanMessages(safeCount, message);
  } catch (error) {
    const config = getAiConfig();
    logAiFailure({
      operation: "generate_fan_messages",
      provider: config.provider,
      model: config.model,
      requestedCount: count,
      messageSnippet: String(message || "").slice(0, 120),
      error
    });
    return fallbackFanMessages(count, message);
  }
}

export async function generateLiveFanMessage(recentArtistMessage = "") {
  const shouldReact = Boolean(recentArtistMessage) && Math.random() < 0.45;
  const kind = shouldReact ? "reaction" : "ambient";

  try {
    const content = await callAi(`Generate one live incoming fan message for a late-night idol bubble inbox.
Mode:
- ${shouldReact ? "React naturally to the recent idol update." : "Write ambient fan self-talk that does not directly reply to the idol."}
${recentArtistMessage ? `Recent idol update for possible reaction: "${String(recentArtistMessage).slice(0, 400)}"` : "No recent idol update is available."}
The detailed fan-message page should feel like many fans are continuously talking.
JSON shape:
{
  "fanMessage": {
    "fanName": "short nickname",
    "avatar": "🐰",
    "personaType": "comfort guardian",
    "messageKind": "${kind}",
    "language": "zh",
    "content": "short original fan message",
    "translatedContent": "中文翻译"
  }
}`);
    const parsed = extractJson(content);
    return normalizeFanMessage(parsed.fanMessage || parsed, 0, kind);
  } catch (error) {
    const config = getAiConfig();
    logAiFailure({
      operation: "generate_live_fan_message",
      provider: config.provider,
      model: config.model,
      messageKind: kind,
      recentArtistMessageSnippet: String(recentArtistMessage || "").slice(0, 120),
      error
    });
    return fallbackFanMessage(0, recentArtistMessage, kind);
  }
}

export async function generateLiveFanMessages(recentArtistMessage = "", count = 8) {
  const safeCount = Math.max(1, Math.min(Number(count || 8), 12));
  try {
    const content = await callAi(`Generate ${safeCount} live incoming fan messages for a late-night idol bubble inbox.
Context:
${recentArtistMessage ? `Recent idol update for possible reactions: "${String(recentArtistMessage).slice(0, 400)}"` : "No recent idol update is available."}
The detailed fan-message page should feel like many fans are continuously talking.
Mix message kinds:
- About 60% ambient fan self-talk / general chatter.
- About 40% reaction messages if there is a recent idol update.
Use many different nicknames, avatars, persona types, languages, and emotional tones.
JSON shape:
{
  "fanMessages": [
    {
      "fanName": "short nickname",
      "avatar": "🐰",
      "personaType": "comfort guardian",
      "messageKind": "ambient",
      "language": "zh",
      "content": "short original fan message",
      "translatedContent": "中文翻译"
    }
  ]
}`);
    const parsed = extractJson(content);
    const fanMessages = Array.isArray(parsed.fanMessages) ? parsed.fanMessages : [];
    const normalized = fanMessages.slice(0, safeCount).map((item, index) => {
      const fallbackKind = recentArtistMessage && index % 3 === 1 ? "reaction" : "ambient";
      return normalizeFanMessage(item, index, fallbackKind);
    });
    return normalized.length ? normalized : fallbackFanMessages(safeCount, recentArtistMessage);
  } catch (error) {
    const config = getAiConfig();
    logAiFailure({
      operation: "generate_live_fan_messages",
      provider: config.provider,
      model: config.model,
      requestedCount: safeCount,
      recentArtistMessageSnippet: String(recentArtistMessage || "").slice(0, 120),
      error
    });
    return fallbackFanMessages(safeCount, recentArtistMessage);
  }
}
