import { FanMessage } from "@/types/idol";
import {
  generateFanMessagesAfterSend as generateMockFanMessagesAfterSend,
  generateLiveFanMessage as generateMockLiveFanMessage
} from "@/services/mockData";
import { apiFetch } from "@/services/apiClient";

const apiBaseUrl = process.env.EXPO_PUBLIC_IDOL_MODE_API_URL?.replace(/\/$/, "");

type FanMessageResponse = {
  fanMessages?: FanMessage[];
  fanMessage?: FanMessage;
  status?: "processing";
  retryAfterMs?: number;
};

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeout)
  };
}

function normalizeFanMessage(message: FanMessage, fallbackId: string): FanMessage {
  return {
    id: message.id || fallbackId,
    fanName: message.fanName || "fan",
    avatar: message.avatar || "🐰",
    language: message.language || "zh",
    content: message.content || "来了来了。",
    translatedContent: message.translatedContent || message.content || "来了来了。",
    fromMessageId: message.fromMessageId,
    personaType: message.personaType,
    messageKind: message.messageKind
  };
}

async function postToApi(path: string, body: object): Promise<FanMessageResponse | null> {
  if (!apiBaseUrl) return null;

  const timeout = withTimeout(45000);
  try {
    const response = await apiFetch(path, {
      method: "POST",
      body: JSON.stringify(body),
      signal: timeout.signal
    });

    if (!response.ok) {
      throw new Error(`AI API request failed: ${response.status}`);
    }

    return (await response.json()) as FanMessageResponse;
  } finally {
    timeout.cancel();
  }
}

export async function generateFanMessagesAfterSend(message: string): Promise<FanMessage[]> {
  try {
    const data = await postToApi("/ai/fan-messages", { message, count: 4 });
    const fanMessages = data?.fanMessages;
    if (fanMessages?.length) {
      return fanMessages.map((item, index) => normalizeFanMessage(item, `api-generated-${Date.now()}-${index}`));
    }
  } catch (error) {
    console.warn("Falling back to mock fan messages.", error);
  }

  return generateMockFanMessagesAfterSend(message);
}

export async function generateFanMessagesAfterSendForMessage(message: string, sourceMessageId: string): Promise<FanMessage[]> {
  try {
    const data = await postToApi("/ai/fan-messages", { message, sourceMessageId, count: 4 });
    const fanMessages = data?.fanMessages;
    if (fanMessages?.length) {
      return fanMessages.map((item, index) => normalizeFanMessage(item, `api-generated-${Date.now()}-${index}`));
    }
  } catch (error) {
    console.warn("Falling back to mock fan messages.", error);
  }

  return generateMockFanMessagesAfterSend(message);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestReactionBurst(
  body: {
    message: string;
    sourceMessageId: string;
    count: number;
    quotedContent?: string;
  },
  signal: AbortSignal,
  attemptsLeft: number
): Promise<FanMessageResponse> {
  const response = await apiFetch("/ai/reaction-burst", {
    method: "POST",
    body: JSON.stringify(body),
    signal
  });

  const data = (await response.json().catch(() => ({}))) as FanMessageResponse;

  if (response.status === 202) {
    if (attemptsLeft <= 0) {
      throw new Error("Reaction burst is still processing after retries.");
    }
    await delay(Math.max(500, Math.min(data.retryAfterMs ?? 3000, 5000)));
    return requestReactionBurst(body, signal, attemptsLeft - 1);
  }

  if (!response.ok) {
    throw new Error(`Reaction burst API failed: ${response.status}`);
  }

  return data;
}

/**
 * reaction burst：confirm-send 后调用，生成 24–40 条强相关粉丝反应。
 * 分 4 批并行请求（每批 8 条），避免单次 AI 响应 token 截断。
 * 所有消息 messageKind = "reaction"，内容必须直接回应 idolMessage。
 */
export async function generateReactionBurst(
  message: string,
  sourceMessageId: string,
  count = 32,
  quotedContent?: string
): Promise<FanMessage[]> {
  const stamp = Date.now();
  if (!apiBaseUrl) {
    console.error("Reaction burst API URL is not configured. Set EXPO_PUBLIC_IDOL_MODE_API_URL and restart Expo.");
    return [];
  }

  // reaction-burst 专用超时 65s（服务端 AI 生成 32 条消息最多需要 50s）
  const timeout = withTimeout(65_000);

  try {
    const data = await requestReactionBurst({
      message,
      sourceMessageId,
      count,
      ...(quotedContent ? { quotedContent } : {})
    }, timeout.signal, 2);

    const msgs = data?.fanMessages ?? [];
    if (msgs.length > 0) {
      return msgs.map((item, i) =>
        normalizeFanMessage(item, `reaction-burst-${stamp}-${i}`)
      );
    }
    console.warn("Reaction burst API returned no fanMessages.");
  } catch (error) {
    console.warn("Reaction burst API unavailable.", error);
  } finally {
    timeout.cancel();
  }

  return [];
}

export async function generateLiveFanMessage(recentArtistMessage?: string): Promise<FanMessage> {
  try {
    const data = await postToApi("/ai/live-fan-message", { recentArtistMessage, persist: false });
    if (data?.fanMessage) {
      return normalizeFanMessage(data.fanMessage, `api-live-${Date.now()}`);
    }
  } catch (error) {
    console.warn("Falling back to mock live fan message.", error);
  }

  return generateMockLiveFanMessage(recentArtistMessage);
}

/**
 * live batch：调用 /ai/live-batch，一次返回 30 条 ambient 消息。
 * 后端从 ambient pool 取（内存缓冲 → PG → 模板 fallback），不调 AI。
 * count 参数保留兼容性，实际由后端决定返回数量。
 */
export async function generateLiveBatch(
  lastIdolMessage?: string,
  count = 30
): Promise<FanMessage[]> {
  const safeCount = Math.max(8, Math.min(count, 60));
  try {
    const data = await postToApi("/ai/live-batch", {
      count: safeCount,
      ...(lastIdolMessage ? { lastIdolMessage } : {})
    });
    const fanMessages = data?.fanMessages;
    if (fanMessages?.length) {
      return fanMessages.map((item, index) =>
        normalizeFanMessage(item, `live-batch-${Date.now()}-${index}`)
      );
    }
  } catch (error) {
    console.warn("Live batch API unavailable, using mock fallback.", error);
  }

  // 降级：本地 mock 生成
  return Array.from({ length: safeCount }, (_, index) => ({
    ...generateMockLiveFanMessage(),
    id: `live-batch-fallback-${Date.now()}-${index}`,
    messageKind: "ambient" as const
  }));
}

// 保留旧名称兼容 context 里的调用
export async function generateLiveFanMessages(recentArtistMessage?: string, count = 8): Promise<FanMessage[]> {
  return generateLiveBatch(recentArtistMessage, count);
}

/**
 * history burst：进入粉丝消息页时调用，从 DB history_messages 随机采样。
 * 不调用 AI，返回 ambient 消息。
 */
export async function fetchHistoryBurst(count = 50): Promise<FanMessage[]> {
  try {
    const data = await postToApi("/ai/history-burst", { count });
    const fanMessages = data?.fanMessages;
    if (fanMessages?.length) {
      return fanMessages.map((item, index) =>
        normalizeFanMessage(item, `history-burst-${Date.now()}-${index}`)
      );
    }
  } catch (error) {
    console.warn("History burst API unavailable, using live mock fallback.", error);
  }

  // 降级：用 live mock 生成同等数量的消息
  return Array.from({ length: count }, (_, index) => ({
    ...generateMockLiveFanMessage(),
    id: `history-fallback-${Date.now()}-${index}`,
    messageKind: "ambient" as const
  }));
}
