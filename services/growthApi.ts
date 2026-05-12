import { IdolGrowthStats } from "@/types/idol";
import { apiFetch } from "./apiClient";

/**
 * 从服务端拉取当前用户的成长数据。
 * 若请求失败（离线 / 未登录）返回 null，调用方自行降级。
 */
export async function fetchGrowthStats(): Promise<IdolGrowthStats | null> {
  try {
    const res = await apiFetch("/me/growth");
    if (!res.ok) return null;
    // 服务端返回 { stats: IdolGrowthStats, requestId }
    const data = await res.json();
    return (data.stats ?? null) as IdolGrowthStats | null;
  } catch {
    return null;
  }
}

/**
 * 触发服务端每日结算（幂等）。
 * 通常在 App 前台激活时调用一次；服务端会自动判断是否需要结算。
 * 返回结算后的最新数据，失败返回 null。
 */
export async function settleDailyGrowth(): Promise<IdolGrowthStats | null> {
  try {
    const res = await apiFetch("/me/growth/settle", { method: "PATCH" });
    if (!res.ok) return null;
    // 服务端返回 { stats: IdolGrowthStats, newAchievements, bonusFollowers, requestId }
    const data = await res.json();
    return (data.stats ?? null) as IdolGrowthStats | null;
  } catch {
    return null;
  }
}
