import OpenAI from "openai";
import {
  buildSystemPrompt,
  fallbackFanMessage,
  fallbackFanMessages,
  normalizeFanMessage
} from "./fanPersonas.mjs";
import { logAiFailure } from "./logger.mjs";
import { describeTimeContext, preferredPersonaTypesForTime, resolveTimeContext } from "./timeContext.mjs";

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
    maxTokens: Number(process.env.QWEN_MAX_TOKENS || process.env.AI_MAX_TOKENS || process.env.DEEPSEEK_MAX_TOKENS || 4000)
  };
}

async function postChatCompletion(payload, retryWithoutJsonMode = true) {
  const config = getAiConfig();
  if (!config.apiKey) {
    throw new Error("Missing QWEN_API_KEY or DASHSCOPE_API_KEY.");
  }

  // 服务端超时：50s，防止 Qwen 长时间无响应导致前端先断开
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50_000);

  let response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

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
    stream: false,
    // disable chain-of-thought for qwen3.x thinking models
    enable_thinking: false
  });

  return data?.choices?.[0]?.message?.content || "";
}

export async function checkAiConnection() {
  const startedAt = Date.now();
  const config = getAiConfig();
  const content = await callAi(`Return only valid JSON:
{
  "ok": true,
  "message": "pong"
}`);
  const parsed = extractJson(content);
  return {
    ok: Boolean(parsed.ok),
    provider: config.provider,
    model: config.model,
    message: parsed.message || "",
    durationMs: Date.now() - startedAt
  };
}

export function getAsrConfig() {
  const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
  const baseUrl = process.env.QWEN_ASR_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = process.env.QWEN_ASR_MODEL || "qwen3-asr-flash";

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ""),
    model,
    provider: "qwen-asr"
  };
}

function extractAsrText(data) {
  const candidates = [
    data?.choices?.[0]?.message?.content,
    data?.text,
    data?.output?.text,
    data?.output?.sentence?.text,
    data?.output?.transcription,
    data?.result?.text,
    data?.transcription
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (Array.isArray(data?.output?.sentences)) {
    return data.output.sentences.map((item) => item?.text || "").join(" ").trim();
  }
  return "";
}

export async function transcribeAudio({ audioBase64, audioBuffer, mimeType }) {
  const config = getAsrConfig();
  if (!config.apiKey) {
    throw new Error("Missing QWEN_API_KEY or DASHSCOPE_API_KEY for ASR.");
  }

  const data = audioBase64 || Buffer.from(audioBuffer || []).toString("base64");
  const audioDataUriOrPublicUrl = String(data || "").startsWith("data:") || /^https?:\/\//.test(String(data || ""))
    ? String(data)
    : `data:${mimeType || "audio/mpeg"};base64,${data}`;
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: {
                data: audioDataUriOrPublicUrl
              }
            }
          ]
        }
      ],
      stream: false,
      extra_body: {
        asr_options: {
          enable_itn: true
        }
      }
    }, { signal: controller.signal });

    return extractAsrText(response);
  } catch (error) {
    logAiFailure({
      operation: "qwen_asr",
      provider: config.provider,
      model: config.model,
      endpoint: `${config.baseUrl}/chat/completions`,
      mimeType,
      error
    });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getImageCaptionConfig() {
  const base = getAiConfig();
  return {
    ...base,
    model: process.env.IMAGE_CAPTION_MODEL || base.model,
    maxTokens: Number(process.env.IMAGE_CAPTION_MAX_TOKENS || 220),
    temperature: Number(process.env.IMAGE_CAPTION_TEMPERATURE || 0.2),
    allowedHostSuffix: process.env.IMAGE_CAPTION_ALLOWED_HOST_SUFFIX || ""
  };
}

function validatePublicImageUrl(imageUrl) {
  const raw = String(imageUrl || "").trim();
  if (!raw || raw.length > 2048) throw new Error("Invalid image URL.");
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:") throw new Error("Image URL must use HTTPS.");
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Image URL host is not allowed.");
  }
  const { allowedHostSuffix } = getImageCaptionConfig();
  if (allowedHostSuffix && !hostname.endsWith(allowedHostSuffix.toLowerCase())) {
    throw new Error("Image URL host is not allowed for captioning.");
  }
  return parsed.toString();
}

export async function generateImageCaption(imageUrl) {
  const config = getImageCaptionConfig();
  if (!config.apiKey) {
    throw new Error("Missing QWEN_API_KEY or DASHSCOPE_API_KEY for image captioning.");
  }
  const safeImageUrl = validatePublicImageUrl(imageUrl);
  const imageHost = new URL(safeImageUrl).hostname;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: safeImageUrl }
              },
              {
                type: "text",
                text: `请为这张偶像 bubble 图片生成一段给粉丝反应用的简体中文描述。\n\n只返回 JSON：\n{\n  "caption": "80字以内，描述图片中可见的画面、氛围、动作或物品"\n}\n\n规则：不要识别真实人物身份；不要推断敏感属性；不要色情化；如果画面不清楚就简短说明。`
              }
            ]
          }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        response_format: { type: "json_object" },
        stream: false,
        enable_thinking: false
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Image caption API failed with ${response.status}: ${detail}`);
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(raw);
    return String(parsed.caption || "").trim().slice(0, 160);
  } catch (error) {
    logAiFailure({
      operation: "generate_image_caption",
      provider: config.provider,
      model: config.model,
      imageHost,
      error
    });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateReactionBurst(message, count = 16, quotedContent = null, memoryContext = "", timeContext = {}, imageCaption = "") {
  const safeCount = Math.max(8, Math.min(Number(count || 16), 16));
  const batchSize = 8;
  const batches = Math.ceil(safeCount / batchSize);
  const fanMessages = [];

  for (let batch = 0; batch < batches; batch++) {
    const batchCount = Math.min(batchSize, safeCount - fanMessages.length);
    if (batchCount <= 0) break;
    const batchMessages = await generateReactionBurstBatch(message, batchCount, quotedContent, memoryContext, batch + 1, batches, timeContext, imageCaption);
    fanMessages.push(...batchMessages);
  }

  return fanMessages.slice(0, safeCount);
}

async function generateReactionBurstBatch(message, count = 8, quotedContent = null, memoryContext = "", batchNumber = 1, totalBatches = 1, timeContext = {}, imageCaption = "") {
  const safeCount = Math.max(1, Math.min(Number(count || 8), 8));
  const quotedLine = quotedContent
    ? `\nThe idol also quoted this fan message in their post: "${String(quotedContent).slice(0, 200)}"\nSome fans should react to the quoted fan message too — jealousy, curiosity, wanting to be quoted next, etc.\n`
    : "";
  const imageLine = imageCaption
    ? `\nThe idol also attached an image. Image description in Chinese: "${String(imageCaption).slice(0, 180)}"\nFans may naturally react to visible image details, but must not invent details beyond this description.\n`
    : "";
  try {
    const content = await callAi(`The idol just posted this bubble update: "${String(message || "").slice(0, 400)}"
${quotedLine}${imageLine}
Generate ${safeCount} fan reactions for batch ${batchNumber}/${totalBatches}. Make them feel like a real fan comment section exploding after an idol posts.
${timeContextPrompt(timeContext)}

Distribution rules (approximate):
- 50% direct reactions to the idol's exact words/content or attached image if present
- 15% over-interpretation / reading too much into it
- 15% caring about idol's health/emotions
- 10% fans relating it to their own life
- 5% chaotic/absurd humor
- 5% mild teasing / demanding more content
${quotedContent ? "- Some fans should react to the quoted fan message (jealous, curious, wanting to be quoted next)" : ""}

Critical rules:
- Every message MUST be clearly inspired by the idol's specific words/image context: "${String(message || "").slice(0, 200)}"${imageCaption ? ` / image: "${String(imageCaption).slice(0, 120)}"` : ""}
- Do NOT generate generic "宝宝辛苦了" or "加油" type messages unless they directly reference the idol's content
- Use wildly different personas, nicknames, languages, and emotional tones
- Mix languages: ~50% zh, ~20% en, ~15% ko, ~10% jp, ~5% es
- Keep each message short (max 80 chars)
- messageKind must be "reaction" for all messages
- translatedContent must be Simplified Chinese for every message. For en/ko/jp/es content, translate it into Chinese; do not copy the foreign original into translatedContent.
- Every fan message MUST include "usedMemoryIds": [] (empty array if no memory used)
${memoryContext}
JSON shape:
{
  "fanMessages": [
    {
      "fanName": "short nickname",
      "avatar": "🐰",
      "personaType": "comfort guardian",
      "messageKind": "reaction",
      "language": "zh",
      "content": "short fan reaction directly referencing the idol's message",
      "translatedContent": "简体中文翻译",
      "usedMemoryIds": []
    }
  ]
}`);
    const parsed = extractJson(content);
    const fanMessages = Array.isArray(parsed.fanMessages) ? parsed.fanMessages : [];
    const normalized = fanMessages.slice(0, safeCount).map((item, index) =>
      normalizeFanMessage(item, (batchNumber - 1) * 8 + index, "reaction")
    );
    if (!normalized.length) {
      throw new Error("AI reaction burst returned no fanMessages.");
    }
    return normalized;
  } catch (error) {
    const config = getAiConfig();
    logAiFailure({
      operation: "generate_reaction_burst",
      provider: config.provider,
      model: config.model,
      requestedCount: safeCount,
      batchNumber,
      totalBatches,
      messageSnippet: String(message || "").slice(0, 120),
      error
    });
    throw error;
  }
}

export async function generateFanMessages(message, count = 4, timeContext = {}) {
  try {
    const safeCount = Math.max(1, Math.min(Number(count || 4), 8));
    const content = await callAi(`The idol just sent this bubble update: "${String(message || "").slice(0, 400)}"
${timeContextPrompt(timeContext)}
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

function timeContextPrompt(timeContext = {}) {
  const resolved = resolveTimeContext(timeContext);
  const preferred = preferredPersonaTypesForTime(resolved);
  return `${describeTimeContext(resolved)}
Persona guidance:
- Do not create or use a "late night fan" persona.
${preferred.length ? `- For this period, occasionally favor these extra personas: ${preferred.join(", ")}.` : "- Use the normal persona mix."}
- If period is not "late_night", do not mention midnight, late night, insomnia, bedtime, goodnight, or moon/night imagery unless the idol explicitly mentioned it.`;
}

export async function generateLiveFanMessage(recentArtistMessage = "", timeContext = {}) {
  const shouldReact = Boolean(recentArtistMessage) && Math.random() < 0.45;
  const kind = shouldReact ? "reaction" : "ambient";

  try {
    const content = await callAi(`Generate one live incoming fan message for an idol bubble inbox.
${timeContextPrompt(timeContext)}
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

export async function generateLiveFanMessages(recentArtistMessage = "", count = 8, timeContext = {}) {
  const safeCount = Math.max(1, Math.min(Number(count || 8), 30));
  try {
    const content = await callAi(`Generate ${safeCount} live incoming fan messages for an idol bubble inbox.
${timeContextPrompt(timeContext)}
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
