export type Profile = {
  id: string;
  nickname: string;
  signature: string;
  email: string;
  avatar: string;
  gender?: "female" | "male" | "nonbinary" | "prefer_not_to_say" | "";
  age?: number | null;
  /** 个人主页背景图 URI，无则用纯色渐变 */
  backgroundImage?: string;
  /** 状态文字，显示在签名下方 */
  statusText?: string;
};

export type ChatAttachmentType = "background" | "sticker";

export type QuotedFanMessage = {
  id: string;
  content: string;
};

export type Artist = {
  id: string;
  nickname: string;
  avatar: string;
  background: string;
  bio: string;
  signature: string;
  identity: string;
  fans: string;
  intro: string;
};

export type ChatMessage = {
  id: string;
  sender: "self" | "artist" | "fan" | "user";
  text: string;
  status?: "draft" | "pending" | "sent";
  createdAt: string;
  attachmentType?: ChatAttachmentType;
  attachmentUri?: string;
  quotedFanMessage?: QuotedFanMessage;
};

export type IdolChatThread = {
  artistId: string;
  messages: ChatMessage[];
};

export type FanMessage = {
  id: string;
  fanName: string;
  avatar: string;
  language: "zh" | "en" | "ko" | "jp" | "es";
  content: string;
  translatedContent: string;
  fromMessageId?: string;
  personaType?: string;
  messageKind?: "ambient" | "reaction";
  /** reaction-burst 记忆注入：本条消息引用的记忆 ID 列表 */
  usedMemoryIds?: string[];
};

export type MemoryType = "preference" | "habit" | "life_event" | "creative_context" | "emotion";

export type Memory = {
  id: string;
  memory_type: MemoryType;
  content: string;
  importance: number;          // 1-5
  mention_count: number;
  last_mentioned_at: number | null;
  user_suppressed: boolean;
  created_at: number;
};

export type IdolGrowthStats = {
  /** 今日营业值，每日上限 100 */
  dailyBusinessValue: number;
  maxDailyBusinessValue: 100;
  /** 粉丝数 */
  followers: number;
  /** 历史营业值总和 */
  totalEcho: number;
  /** 连续营业天数 */
  streakDays: number;
  /** 连续未营业天数 */
  inactiveDays: number;
  /** 最后一次营业日期 YYYY-MM-DD */
  lastActiveDate: string | null;
  /** 最后一次每日结算日期 YYYY-MM-DD */
  lastSettlementDate: string | null;
  /** 已解锁成就 ID 列表 */
  unlockedAchievements: string[];
  /** 已解锁粉丝人格（预留） */
  unlockedPersonas: string[];
};
