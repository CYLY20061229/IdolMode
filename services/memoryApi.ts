import { Memory, MemoryType } from "@/types/idol";
import { apiFetch } from "./apiClient";

/**
 * 获取当前用户所有未归档记忆（管理页用）。
 */
export async function fetchMemories(): Promise<Memory[]> {
  try {
    const res = await apiFetch("/me/memories");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.memories) ? data.memories : [];
  } catch {
    return [];
  }
}

/**
 * 物理删除一条记忆（永久移除）。
 */
export async function deleteMemory(memoryId: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/me/memories/${encodeURIComponent(memoryId)}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 将一条记忆标记为"不再提起"（user_suppressed = true）。
 * 记忆仍保留在数据库，但不会再注入到 AI 生成中。
 */
export async function suppressMemory(memoryId: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/me/memories/${encodeURIComponent(memoryId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "suppress" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 用户手动写入一条记忆，写入后立即持久化到数据库。
 */
export async function writeMemory(content: string, memoryType: MemoryType): Promise<boolean> {
  try {
    const res = await apiFetch("/me/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, memoryType }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
export async function updateMemory(
  memoryId: string,
  input: {
    content: string;
    memoryType?: MemoryType;
  }
): Promise<Memory | null> {
  try {
    const res = await apiFetch(`/me/memories/${encodeURIComponent(memoryId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        content: input.content,
        memoryType: input.memoryType
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.memory || null;
  } catch {
    return null;
  }
}
