import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { Artist, ChatMessage, FanMessage, IdolChatThread, Profile, UserPreferences } from "@/types/idol";

const apiBaseUrl = process.env.EXPO_PUBLIC_IDOL_MODE_API_URL?.replace(/\/$/, "") ?? "";

const USER_ID_KEY = "idol_mode_user_id";
const DEVICE_ID_KEY = "idol_mode_device_id";
const SESSION_TOKEN_KEY = "idol_mode_session_token";

// ── internal helpers ──────────────────────────────────────────────────────────

let cachedUserId: string | null = null;
let cachedSessionToken: string | null = null;

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

export async function getSessionToken(): Promise<string> {
  if (cachedSessionToken) return cachedSessionToken;
  const stored = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
  if (stored) {
    cachedSessionToken = stored;
    return stored;
  }
  return "";
}

async function storeUserId(userId: string): Promise<void> {
  cachedUserId = userId;
  await AsyncStorage.setItem(USER_ID_KEY, userId);
}

async function storeSessionToken(sessionToken: string): Promise<void> {
  cachedSessionToken = sessionToken;
  await AsyncStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
}

function isApiAvailable(): boolean {
  return Boolean(apiBaseUrl);
}

function isLocalMediaUri(value?: string): boolean {
  return Boolean(value && /^(file|content|blob|data):/.test(value));
}

function avatarFallbackFromNickname(profile: Profile): string {
  return (profile.nickname || "新").slice(0, 2).toUpperCase();
}

function profileForApi(profile: Profile): Profile {
  return {
    ...profile,
    avatar: isLocalMediaUri(profile.avatar) ? avatarFallbackFromNickname(profile) : profile.avatar,
    backgroundImage: isLocalMediaUri(profile.backgroundImage) ? undefined : profile.backgroundImage
  };
}

function messageForApi(message: ChatMessage): ChatMessage {
  if (!isLocalMediaUri(message.attachmentUri)) return message;
  return {
    ...message,
    attachmentUri: undefined
  };
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const userId = await getUserId();
  const sessionToken = await getSessionToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>)
  };

  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  } else if (userId) {
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
    const existingSessionToken = await getSessionToken();
    if (existingSessionToken) {
      const session = await fetchAuthSession();
      if (session?.userId) {
        await storeUserId(session.userId);
        return session.userId;
      }
    }

    const deviceId = await getOrCreateDeviceId();
    const res = await fetch(`${apiBaseUrl}/auth/device`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, platform: "ios" })
    });
    if (!res.ok) return null;
    const data = await res.json() as { user?: { id?: string }; sessionToken?: string };
    const userId = data?.user?.id;
    if (userId) {
      await storeUserId(userId);
      if (data.sessionToken) {
        await storeSessionToken(data.sessionToken);
      }
      return userId;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchAuthSession(): Promise<(BootstrapData & { userId: string }) | null> {
  if (!isApiAvailable()) return null;
  const sessionToken = await getSessionToken();
  if (!sessionToken) return null;

  try {
    const res = await apiFetch("/auth/session");
    if (!res.ok) return null;
    return (await res.json()) as BootstrapData & { userId: string };
  } catch {
    return null;
  }
}

export async function logoutDeviceSession(): Promise<void> {
  if (!isApiAvailable()) return;
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // silent
  } finally {
    cachedSessionToken = null;
    cachedUserId = null;
    await AsyncStorage.multiRemove([SESSION_TOKEN_KEY, USER_ID_KEY]);
  }
}

// ── bootstrap ─────────────────────────────────────────────────────────────────

/**
 * 登录后拉取用户全量数据，用于初始化 Context。
 * 失败时返回 null，Context 继续用 mock 初始值。
 */
export async function fetchBootstrap(): Promise<BootstrapData | null> {
  if (!isApiAvailable()) return null;
  const sessionToken = await getSessionToken();
  const userId = await getUserId();
  if (!sessionToken && !userId) return null;
  try {
    const res = await apiFetch("/me/bootstrap");
    if (!res.ok) return null;
    return (await res.json()) as BootstrapData;
  } catch {
    return null;
  }
}

// ── profile ───────────────────────────────────────────────────────────────────

export async function apiUpdateProfile(profile: Profile): Promise<Profile> {
  if (!isApiAvailable()) return profile;
  const response = await apiFetch("/me/profile", {
    method: "PUT",
    body: JSON.stringify({ profile: profileForApi(profile) })
  });
  const data = await response.json().catch(() => ({})) as { profile?: Profile; message?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.message || data.error || `资料保存失败：${response.status}`);
  }
  if (!data.profile) {
    throw new Error("资料保存失败：服务器没有返回资料。");
  }
  return data.profile;
}

// ── friends ───────────────────────────────────────────────────────────────────

export async function apiAddFriend(artistId: string): Promise<void> {
  if (!isApiAvailable()) return;
  try {
    const response = await apiFetch("/me/friends", {
      method: "POST",
      body: JSON.stringify({ artistId })
    });
    if (!response.ok) {
      console.warn("Add friend sync failed.", response.status);
    }
  } catch {
    console.warn("Add friend sync failed.");
  }
}

export async function apiRemoveFriend(artistId: string): Promise<void> {
  if (!isApiAvailable()) return;
  try {
    const response = await apiFetch(`/me/friends/${encodeURIComponent(artistId)}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      console.warn("Remove friend sync failed.", response.status);
    }
  } catch {
    console.warn("Remove friend sync failed.");
  }
}

type ApiMutationResult = {
  ok: boolean;
  status?: number;
  message?: string;
  error?: string;
};

export type AccountMe = {
  user: {
    id: string;
    nickname: string;
    avatar: string;
    role: string;
    isEmailVerified: boolean;
    emailMasked: string;
    entitlement?: {
      plan: string;
      status: string;
      startedAt?: number | null;
      expiresAt?: number | null;
      source?: string | null;
    };
  } | null;
  profile?: Profile | null;
  entitlement?: {
    plan: string;
    status: string;
    startedAt?: number | null;
    expiresAt?: number | null;
    source?: string | null;
  } | null;
  preferences?: UserPreferences | null;
};

export async function apiSendEmailCode(email: string): Promise<{ emailMasked: string; cooldownSeconds: number }> {
  const response = await apiFetch("/api/auth/email/send", {
    method: "POST",
    body: JSON.stringify({ email, purpose: "login" })
  });
  const data = await response.json().catch(() => ({})) as { emailMasked?: string; cooldownSeconds?: number; message?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.message || data.error || "验证码发送失败。");
  }
  return {
    emailMasked: data.emailMasked || "",
    cooldownSeconds: data.cooldownSeconds || 60
  };
}

export async function apiLoginWithEmail(email: string, code: string): Promise<AccountMe> {
  const response = await apiFetch("/api/auth/email/login", {
    method: "POST",
    body: JSON.stringify({ email, code })
  });
  const data = await response.json().catch(() => ({})) as AccountMe & { token?: string; message?: string; error?: string };
  if (!response.ok || !data.token || !data.user?.id) {
    throw new Error(data.message || data.error || "登录失败。");
  }
  await storeSessionToken(data.token);
  await storeUserId(data.user.id);
  return data;
}

export async function apiFetchMe(): Promise<AccountMe | null> {
  try {
    const response = await apiFetch("/api/me");
    if (!response.ok) return null;
    return (await response.json()) as AccountMe;
  } catch {
    return null;
  }
}

export async function apiDeleteAccount(): Promise<void> {
  const response = await apiFetch("/api/me/account", { method: "DELETE", body: JSON.stringify({}) });
  const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.message || data.error || "账号注销失败。");
  }
  cachedSessionToken = null;
  cachedUserId = null;
  await AsyncStorage.multiRemove([SESSION_TOKEN_KEY, USER_ID_KEY]);
}

export async function apiUpdatePreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
  const response = await apiFetch("/api/me/preferences", {
    method: "PATCH",
    body: JSON.stringify({ preferences })
  });
  const data = await response.json().catch(() => ({})) as { preferences?: UserPreferences; message?: string; error?: string };
  if (!response.ok || !data.preferences) {
    throw new Error(data.message || data.error || "偏好设置保存失败。");
  }
  return data.preferences;
}

// ── self messages ─────────────────────────────────────────────────────────────

export async function apiCreateSelfMessage(message: ChatMessage): Promise<boolean> {
  if (!isApiAvailable()) return false;
  const safeMessage = messageForApi(message);
  try {
    const response = await apiFetch("/me/self-messages", {
      method: "POST",
      body: JSON.stringify({
        id: safeMessage.id,
        text: safeMessage.text,
        type: safeMessage.type,
        poll: safeMessage.poll,
        status: safeMessage.status,
        createdAt: safeMessage.createdAt,
        attachmentType: safeMessage.attachmentType,
        attachmentUri: safeMessage.attachmentUri,
        imageCaption: safeMessage.imageCaption,
        quotedFanMessage: safeMessage.quotedFanMessage
      })
    });
    if (!response.ok) {
      console.warn("Create self message sync failed.", response.status);
      return false;
    }
    return true;
  } catch {
    console.warn("Create self message sync failed.");
    return false;
  }
}

export async function apiCreateFanMessages(fanMessages: FanMessage[], fromSelfMessageId?: string): Promise<boolean> {
  if (!isApiAvailable() || fanMessages.length === 0) return false;
  try {
    const response = await apiFetch("/me/fan-messages", {
      method: "POST",
      body: JSON.stringify({ fanMessages, fromSelfMessageId })
    });
    if (!response.ok) {
      console.warn("Create fan messages sync failed.", response.status);
      return false;
    }
    return true;
  } catch {
    console.warn("Create fan messages sync failed.");
    return false;
  }
}

export async function apiUpdateSelfMessageStatus(messageId: string, status: string): Promise<ApiMutationResult> {
  if (!isApiAvailable()) return { ok: false };
  try {
    const response = await apiFetch(`/me/self-messages/${encodeURIComponent(messageId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
      console.warn("Update self message status sync failed.", response.status);
      return {
        ok: false,
        status: response.status,
        message: data.message,
        error: data.error
      };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    console.warn("Update self message status sync failed.", error);
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

// ── idol chat messages ────────────────────────────────────────────────────────

export async function apiCreateIdolChatMessage(artistId: string, message: ChatMessage): Promise<void> {
  if (!isApiAvailable()) return;
  const safeMessage = messageForApi(message);
  try {
    const response = await apiFetch("/me/idol-chat-messages", {
      method: "POST",
      body: JSON.stringify({ artistId, message: safeMessage })
    });
    if (!response.ok) {
      console.warn("Idol chat message sync failed.", response.status);
    }
  } catch {
    console.warn("Idol chat message sync failed.");
  }
}
