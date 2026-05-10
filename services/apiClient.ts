import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { Artist, ChatMessage, FanMessage, IdolChatThread, Profile } from "@/types/idol";

const apiBaseUrl = process.env.EXPO_PUBLIC_IDOL_MODE_API_URL?.replace(/\/$/, "") ?? "";

const USER_ID_KEY = "idol_mode_user_id";
const DEVICE_ID_KEY = "idol_mode_device_id";

// ── internal helpers ──────────────────────────────────────────────────────────

let cachedUserId: string | null = null;

async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${Date.now()}-${Math.random()}`
    );
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const stored = await AsyncStorage.getItem(USER_ID_KEY);
  if (stored) {
    cachedUserId = stored;
    return stored;
  }
  return "";
}

async function storeUserId(userId: string): Promise<void> {
  cachedUserId = userId;
  await AsyncStorage.setItem(USER_ID_KEY, userId);
}

function isApiAvailable(): boolean {
  return Boolean(apiBaseUrl);
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const userId = await getUserId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>)
  };
  if (userId) {
    headers["X-User-Id"] = userId;
  }
  return fetch(`${apiBaseUrl}${path}`, { ...options, headers });
}

// ── bootstrap types ───────────────────────────────────────────────────────────

export type BootstrapData = {
  profile: Profile | null;
  recommendedArtists: Artist[];
  addedArtists: Artist[];
  selfMessages: ChatMessage[];
  fanMessages: FanMessage[];
  idolThreads: IdolChatThread[];
};

// ── auth ──────────────────────────────────────────────────────────────────────

/**
 * 首次启动时调用。生成或读取 deviceId，向后端注册，返回 userId。
 * 失败时返回 null，App 继续用 mock 数据。
 */
export async function authDevice(): Promise<string | null> {
  if (!isApiAvailable()) return null;
  try {
    const deviceId = await getOrCreateDeviceId();
    const res = await fetch(`${apiBaseUrl}/auth/device`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, platform: "ios" })
    });
    if (!res.ok) return null;
    const data = await res.json() as { user?: { id?: string } };
    const userId = data?.user?.id;
    if (userId) {
      await storeUserId(userId);
      return userId;
    }
    return null;
  } catch {
    return null;
  }
}

// ── bootstrap ─────────────────────────────────────────────────────────────────

/**
 * 登录后拉取用户全量数据，用于初始化 Context。
 * 失败时返回 null，Context 继续用 mock 初始值。
 */
export async function fetchBootstrap(): Promise<BootstrapData | null> {
  if (!isApiAvailable()) return null;
  const userId = await getUserId();
  if (!userId) return null;
  try {
    const res = await apiFetch("/me/bootstrap");
    if (!res.ok) return null;
    return (await res.json()) as BootstrapData;
  } catch {
    return null;
  }
}

// ── profile ───────────────────────────────────────────────────────────────────

/** 乐观更新：本地 state 已更新，后台静默同步到数据库。 */
export async function apiUpdateProfile(profile: Profile): Promise<void> {
  if (!isApiAvailable()) return;
  try {
    await apiFetch("/me/profile", {
      method: "PUT",
      body: JSON.stringify({ profile })
    });
  } catch {
    // silent — local state already updated optimistically
  }
}

// ── friends ───────────────────────────────────────────────────────────────────

export async function apiAddFriend(artistId: string): Promise<void> {
  if (!isApiAvailable()) return;
  try {
    await apiFetch("/me/friends", {
      method: "POST",
      body: JSON.stringify({ artistId })
    });
  } catch {
    // silent
  }
}

export async function apiRemoveFriend(artistId: string): Promise<void> {
  if (!isApiAvailable()) return;
  try {
    await apiFetch(`/me/friends/${encodeURIComponent(artistId)}`, {
      method: "DELETE"
    });
  } catch {
    // silent
  }
}

// ── self messages ─────────────────────────────────────────────────────────────

export async function apiCreateSelfMessage(message: ChatMessage): Promise<void> {
  if (!isApiAvailable()) return;
  try {
    await apiFetch("/me/self-messages", {
      method: "POST",
      body: JSON.stringify({
        id: message.id,
        text: message.text,
        status: message.status,
        createdAt: message.createdAt
      })
    });
  } catch {
    // silent
  }
}

export async function apiUpdateSelfMessageStatus(messageId: string, status: string): Promise<void> {
  if (!isApiAvailable()) return;
  try {
    await apiFetch(`/me/self-messages/${encodeURIComponent(messageId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  } catch {
    // silent
  }
}

// ── idol chat messages ────────────────────────────────────────────────────────

export async function apiCreateIdolChatMessage(artistId: string, message: ChatMessage): Promise<void> {
  if (!isApiAvailable()) return;
  try {
    await apiFetch("/me/idol-chat-messages", {
      method: "POST",
      body: JSON.stringify({ artistId, message })
    });
  } catch {
    // silent
  }
}
