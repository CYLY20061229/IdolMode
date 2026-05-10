import { FanMessage } from "@/types/idol";
import {
  generateFanMessagesAfterSend as generateMockFanMessagesAfterSend,
  generateLiveFanMessage as generateMockLiveFanMessage
} from "@/services/mockData";

const apiBaseUrl = process.env.EXPO_PUBLIC_IDOL_MODE_API_URL?.replace(/\/$/, "");

type FanMessageResponse = {
  fanMessages?: FanMessage[];
  fanMessage?: FanMessage;
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

  const timeout = withTimeout(25000);
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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

export async function generateLiveFanMessage(recentArtistMessage?: string): Promise<FanMessage> {
  try {
    const data = await postToApi("/ai/live-fan-message", { recentArtistMessage });
    if (data?.fanMessage) {
      return normalizeFanMessage(data.fanMessage, `api-live-${Date.now()}`);
    }
  } catch (error) {
    console.warn("Falling back to mock live fan message.", error);
  }

  return generateMockLiveFanMessage(recentArtistMessage);
}

export async function generateLiveFanMessages(recentArtistMessage?: string, count = 8): Promise<FanMessage[]> {
  try {
    const data = await postToApi("/ai/live-fan-messages", { recentArtistMessage, count });
    const fanMessages = data?.fanMessages;
    if (fanMessages?.length) {
      return fanMessages.map((item, index) => normalizeFanMessage(item, `api-live-batch-${Date.now()}-${index}`));
    }
  } catch (error) {
    console.warn("Falling back to mock live fan message batch.", error);
  }

  return Array.from({ length: count }, () => generateMockLiveFanMessage(recentArtistMessage));
}
