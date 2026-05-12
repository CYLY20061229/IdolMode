import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addedArtists as initialAddedArtists,
  fanMessages as initialFanMessages,
  generateFanEmojiReply,
  idolChatMessages as initialIdolChatMessages,
  myProfile as initialProfile,
  recommendedArtists as initialRecommendedArtists,
  selfChatMessages as initialSelfChatMessages
} from "@/services/mockData";
import {
  generateReactionBurst,
  generateLiveFanMessages,
  generateLiveFanMessage
} from "@/services/fanMessageApi";
import {
  authDevice,
  fetchBootstrap,
  apiUpdateProfile,
  apiAddFriend,
  apiRemoveFriend,
  apiCreateSelfMessage,
  apiUpdateSelfMessageStatus,
  apiCreateIdolChatMessage
} from "@/services/apiClient";
import { fetchGrowthStats, settleDailyGrowth } from "@/services/growthApi";
import { Artist, ChatAttachmentType, ChatMessage, FanMessage, IdolChatThread, IdolGrowthStats, Profile, QuotedFanMessage } from "@/types/idol";

const STICKERS_KEY = "idol_mode_custom_stickers";

type SendMessageOptions = {
  attachmentType?: ChatAttachmentType;
  attachmentUri?: string;
  quotedFanMessage?: QuotedFanMessage;
};

type IdolModeContextValue = {
  isReady: boolean;
  isProfileComplete: boolean;
  myProfile: Profile;
  updateProfile: (profile: Profile) => void;
  recommendedArtists: Artist[];
  addedArtists: Artist[];
  addArtist: (artist: Artist) => void;
  removeArtist: (artistId: string) => void;
  isArtistAdded: (artistId: string) => boolean;
  selfMessages: ChatMessage[];
  sendSelfDraft: (text: string, options?: SendMessageOptions) => ChatMessage;
  confirmSelfMessage: (messageId: string) => Promise<void>;
  fanMessages: FanMessage[];
  quotedFanMessage: QuotedFanMessage | null;
  quoteFanMessage: (message: FanMessage) => void;
  clearQuotedFanMessage: () => void;
  stickerUris: string[];
  addSticker: (uri: string) => void;
  appendLiveFanMessage: () => Promise<void>;
  appendLiveFanMessages: (messages: FanMessage[]) => void;
  prependHistoryFanMessages: (messages: FanMessage[]) => void;
  getRecentArtistMessage: () => string | undefined;
  /** 最近一条已发送的 self 消息文本，供 live drip 判断是否做 reaction aftershock */
  lastIdolMessage: string | undefined;
  /** reaction burst 队列，fan-messages.tsx 消费 */
  reactionQueue: React.MutableRefObject<FanMessage[]>;
  translatedMessageIds: string[];
  toggleFanMessageTranslation: (messageId: string) => void;
  idolThreads: IdolChatThread[];
  sendIdolChatMessage: (artistId: string, text: string, options?: SendMessageOptions) => void;
  /** 成长数据，null 表示尚未加载或离线 */
  growthStats: IdolGrowthStats | null;
  /** 手动刷新成长数据（通常不需要，confirmSelfMessage 后自动刷新） */
  refreshGrowthStats: () => Promise<void>;
};

const IdolModeContext = createContext<IdolModeContextValue | null>(null);

function timeNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function IdolModeProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [myProfile, setMyProfile] = useState<Profile>(initialProfile);
  const [recommendedArtists, setRecommendedArtists] = useState<Artist[]>(initialRecommendedArtists);
  const [addedArtists, setAddedArtists] = useState<Artist[]>(initialAddedArtists);
  const [selfMessages, setSelfMessages] = useState<ChatMessage[]>(initialSelfChatMessages);
  const [fanMessages, setFanMessages] = useState<FanMessage[]>(initialFanMessages);
  const [translatedMessageIds, setTranslatedMessageIds] = useState<string[]>([]);
  const [idolThreads, setIdolThreads] = useState<IdolChatThread[]>(initialIdolChatMessages);
  const [lastIdolMessage, setLastIdolMessage] = useState<string | undefined>(undefined);
  const [quotedFanMessage, setQuotedFanMessage] = useState<QuotedFanMessage | null>(null);
  const [stickerUris, setStickerUris] = useState<string[]>([]);
  const [growthStats, setGrowthStats] = useState<IdolGrowthStats | null>(null);

  // reaction burst 队列：confirmSelfMessage 填入，fan-messages.tsx 消费
  const reactionQueue = useRef<FanMessage[]>([]);
  const isProfileComplete = Boolean(myProfile.gender && myProfile.age);

  // Bootstrap: auth device → fetch user data from DB
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        await authDevice();
        const [data, growth] = await Promise.all([
          fetchBootstrap(),
          // 同时触发每日结算（幂等），拿到最新成长数据
          settleDailyGrowth().catch(() => fetchGrowthStats())
        ]);
        if (cancelled) return;

        if (data) {
          if (data.profile) setMyProfile(data.profile);
          setRecommendedArtists(data.recommendedArtists?.length ? data.recommendedArtists : initialRecommendedArtists);
          setAddedArtists(data.addedArtists ?? []);
          setSelfMessages(data.selfMessages ?? []);
          setFanMessages(data.fanMessages ?? []);
          setIdolThreads(data.idolThreads ?? []);
        }
        if (growth) setGrowthStats(growth);
      } catch {
        // Network unavailable — continue with mock data
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    void bootstrap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadStickers() {
      try {
        const raw = await AsyncStorage.getItem(STICKERS_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setStickerUris(parsed.filter((item) => typeof item === "string"));
          }
        }
      } catch {
        // local sticker cache is optional
      }
    }
    void loadStickers();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo<IdolModeContextValue>(() => {
    const updateProfile = (profile: Profile) => {
      setMyProfile(profile);
      void apiUpdateProfile(profile);
    };

    const addArtist = (artist: Artist) => {
      setAddedArtists((current) => {
        if (current.some((item) => item.id === artist.id)) return current;
        return [...current, artist];
      });
      void apiAddFriend(artist.id);
    };

    const removeArtist = (artistId: string) => {
      setAddedArtists((current) => current.filter((artist) => artist.id !== artistId));
      void apiRemoveFriend(artistId);
    };

    const isArtistAdded = (artistId: string) => addedArtists.some((artist) => artist.id === artistId);

    const quoteFanMessage = (message: FanMessage) => {
      setQuotedFanMessage({
        id: message.id,
        content: message.content
      });
    };

    const clearQuotedFanMessage = () => {
      setQuotedFanMessage(null);
    };

    const addSticker = (uri: string) => {
      setStickerUris((current) => {
        if (current.includes(uri)) return current;
        const next = [...current, uri].slice(-24);
        void AsyncStorage.setItem(STICKERS_KEY, JSON.stringify(next));
        return next;
      });
    };

    const sendSelfDraft = (text: string, options: SendMessageOptions = {}) => {
      const message: ChatMessage = {
        id: `self-${Date.now()}`,
        sender: "self",
        text,
        status: "pending",
        createdAt: timeNow(),
        attachmentType: options.attachmentType,
        attachmentUri: options.attachmentUri,
        quotedFanMessage: options.quotedFanMessage ?? quotedFanMessage ?? undefined
      };
      setSelfMessages((current) => [...current, message]);
      void apiCreateSelfMessage(message);
      setQuotedFanMessage(null);
      return message;
    };

    const confirmSelfMessage = async (messageId: string) => {
      const target = selfMessages.find((message) => message.id === messageId);
      if (!target) return;

      await apiCreateSelfMessage({ ...target, status: target.status || "pending" });

      setSelfMessages((current) =>
        current.map((message) => {
          if (message.id !== messageId) return message;
          return { ...message, status: "sent" };
        })
      );
      await apiUpdateSelfMessageStatus(messageId, "sent");

      // 更新 lastIdolMessage，供 live drip 做 reaction aftershock
      setLastIdolMessage(target.text);

      const reply: ChatMessage = {
        id: `fan-emoji-${Date.now()}`,
        sender: "fan",
        text: generateFanEmojiReply(),
        createdAt: timeNow()
      };
      setSelfMessages((current) => [...current, reply]);

      // 异步生成 reaction burst，填入 reactionQueue
      // 如果这条消息引用了粉丝消息，把被引用内容也传给 AI，让粉丝能对引用做出反应
      const quotedContent = target.quotedFanMessage?.content;
      void generateReactionBurst(target.text, target.id, 32, quotedContent).then((burst) => {
        reactionQueue.current = [...reactionQueue.current, ...burst];
      });

      // 营业值已由服务端在 POST /me/self-messages 时更新，这里拉取最新成长数据
      void fetchGrowthStats().then((stats) => {
        if (stats) setGrowthStats(stats);
      });
    };

    const getRecentArtistMessage = () =>
      [...selfMessages]
        .reverse()
        .find((message) => message.sender === "self" && message.status === "sent")?.text;

    const appendLiveFanMessages = (messages: FanMessage[]) => {
      setFanMessages((current) => {
        const next = [...current, ...messages];
        // 最多保留 120 条，超过后裁掉最旧的
        return next.slice(Math.max(next.length - 120, 0));
      });
    };

    const prependHistoryFanMessages = (messages: FanMessage[]) => {
      setFanMessages((current) => [...messages, ...current]);
    };

    const appendLiveFanMessage = async () => {
      const recentArtistMessage = getRecentArtistMessage();
      const liveMessage = await generateLiveFanMessage(recentArtistMessage);
      appendLiveFanMessages([liveMessage]);
    };

    const toggleFanMessageTranslation = (messageId: string) => {
      setTranslatedMessageIds((current) =>
        current.includes(messageId)
          ? current.filter((id) => id !== messageId)
          : [...current, messageId]
      );
    };

    const refreshGrowthStats = async () => {
      const stats = await fetchGrowthStats();
      if (stats) setGrowthStats(stats);
    };

    const sendIdolChatMessage = (artistId: string, text: string, options: SendMessageOptions = {}) => {
      const message: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: "user",
        text,
        createdAt: timeNow(),
        attachmentType: options.attachmentType,
        attachmentUri: options.attachmentUri
      };
      setIdolThreads((current) =>
        current.map((thread) =>
          thread.artistId === artistId
            ? { ...thread, messages: [...thread.messages, message] }
            : thread
        )
      );
      void apiCreateIdolChatMessage(artistId, message);
    };

    return {
      isReady,
      isProfileComplete,
      myProfile,
      updateProfile,
      recommendedArtists,
      addedArtists,
      addArtist,
      removeArtist,
      isArtistAdded,
      selfMessages,
      sendSelfDraft,
      confirmSelfMessage,
      fanMessages,
      quotedFanMessage,
      quoteFanMessage,
      clearQuotedFanMessage,
      stickerUris,
      addSticker,
      appendLiveFanMessage,
      appendLiveFanMessages,
      prependHistoryFanMessages,
      getRecentArtistMessage,
      lastIdolMessage,
      reactionQueue,
      translatedMessageIds,
      toggleFanMessageTranslation,
      idolThreads,
      sendIdolChatMessage,
      growthStats,
      refreshGrowthStats
    };
  }, [addedArtists, fanMessages, growthStats, idolThreads, isProfileComplete, isReady, lastIdolMessage, myProfile, quotedFanMessage, recommendedArtists, selfMessages, stickerUris, translatedMessageIds]);

  return <IdolModeContext.Provider value={value}>{children}</IdolModeContext.Provider>;
}

export function useIdolMode() {
  const context = useContext(IdolModeContext);
  if (!context) {
    throw new Error("useIdolMode must be used inside IdolModeProvider");
  }
  return context;
}
