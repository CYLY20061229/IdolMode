import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addedArtists as initialAddedArtists,
  fanMessages as initialFanMessages,
  generateArtistBubbleMessage,
  generateFanMessagesAfterPoll,
  idolChatMessages as initialIdolChatMessages,
  myProfile as initialProfile,
  recommendedArtists as initialRecommendedArtists,
  selfChatMessages as initialSelfChatMessages
} from "@/services/mockData";
import {
  generateReactionBurst,
  generateReactionBurstFromAudio,
  generateLiveFanMessages,
  generateLiveFanMessage,
  transcribeVoiceMessage
} from "@/services/fanMessageApi";
import {
  authDevice,
  fetchBootstrap,
  apiUpdateProfile,
  apiFetchMe,
  apiAddFriend,
  apiRemoveFriend,
  apiCreateSelfMessage,
  apiCreateFanMessages,
  apiUpdateSelfMessageStatus,
  apiCreateIdolChatMessage
} from "@/services/apiClient";
import { fetchGrowthStats, settleDailyGrowth } from "@/services/growthApi";
import { uploadAudioToOss } from "@/services/uploadApi";
import { Artist, ChatAttachmentType, ChatMessage, FanMessage, IdolChatThread, IdolGrowthStats, Poll, Profile, QuotedFanMessage, UserPreferences } from "@/types/idol";

const STICKERS_KEY = "idol_mode_custom_stickers";
const LOCAL_PROFILE_AVATAR_KEY = "idol_mode_local_profile_avatar";

type SendMessageOptions = {
  attachmentType?: ChatAttachmentType;
  attachmentUri?: string;
  audioDurationMs?: number;
  imageCaption?: string;
  quotedFanMessage?: QuotedFanMessage;
};

type IdolModeContextValue = {
  isReady: boolean;
  isProfileComplete: boolean;
  myProfile: Profile;
  updateProfile: (profile: Profile) => Promise<Profile>;
  recommendedArtists: Artist[];
  addedArtists: Artist[];
  addArtist: (artist: Artist) => void;
  removeArtist: (artistId: string) => void;
  isArtistAdded: (artistId: string) => boolean;
  selfMessages: ChatMessage[];
  sendSelfDraft: (text: string, options?: SendMessageOptions) => ChatMessage;
  sendPoll: (input: { question: string; options: string[]; durationMinutes: number }) => ChatMessage;
  confirmSelfMessage: (messageId: string) => Promise<void>;
  fanMessages: FanMessage[];
  hiddenMessageIds: string[];
  hideMessage: (messageId: string) => void;
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
  preferences: UserPreferences;
  refreshPreferences: () => Promise<void>;
  toggleFanMessageTranslation: (messageId: string) => void;
  idolThreads: IdolChatThread[];
  sendIdolChatMessage: (artistId: string, text: string, options?: SendMessageOptions) => void;
  receiveArtistBubbleMessage: (artistId: string) => ChatMessage;
  /** 成长数据，null 表示尚未加载或离线 */
  growthStats: IdolGrowthStats | null;
  /** 手动刷新成长数据（通常不需要，confirmSelfMessage 后自动刷新） */
  refreshGrowthStats: () => Promise<void>;
  /** 重新从服务端拉取账号数据，邮箱登录/绑定后使用 */
  refreshSessionData: () => Promise<void>;
};

const IdolModeContext = createContext<IdolModeContextValue | null>(null);

function timeNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function isLocalMediaUri(value?: string) {
  return Boolean(value && /^(file|content|blob|data):/.test(value));
}

function isRemoteMediaUri(value?: string) {
  return Boolean(value && /^https?:/.test(value));
}

function addMinutesToTime(minutesToAdd: number) {
  const date = new Date(Date.now() + minutesToAdd * 60 * 1000);
  return date.toISOString();
}

function simulatePoll(question: string, optionTexts: string[], durationMinutes: number, followers: number): Poll {
  const safeFollowers = Math.max(2, followers || 1200);
  const totalVotes = Math.min(safeFollowers, Math.max(2, Math.floor(safeFollowers * (0.28 + Math.random() * 0.34))));
  const hotIndex = Math.floor(Math.random() * optionTexts.length);
  const weights = optionTexts.map((_, index) => {
    const base = 0.55 + Math.random() * 1.75;
    return index === hotIndex ? base + 0.8 + Math.random() * 1.4 : base;
  });
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let assignedVotes = 0;
  let assignedPercentage = 0;
  const options = optionTexts.map((text, index) => {
    const isLast = index === optionTexts.length - 1;
    const voteCount = isLast ? totalVotes - assignedVotes : Math.max(1, Math.floor(totalVotes * (weights[index] / totalWeight)));
    assignedVotes += voteCount;
    const percentage = isLast ? 100 - assignedPercentage : Math.round((voteCount / totalVotes) * 100);
    assignedPercentage += percentage;
    return {
      id: `poll-option-${index + 1}`,
      text,
      voteCount,
      percentage
    };
  });
  const winner = [...options].sort((a, b) => b.voteCount - a.voteCount)[0];

  return {
    id: `poll-${Date.now()}`,
    question,
    options,
    status: "active",
    createdAt: timeNow(),
    closesAt: addMinutesToTime(durationMinutes),
    totalVotes,
    winningOptionId: winner.id,
    messageKind: "poll"
  };
}

function toIsoNow() {
  return new Date().toISOString();
}

function pollReactionText(poll: Poll) {
  const options = poll.options.map((option, index) => `${index + 1}. ${option.text}`).join("\n");
  return `发起了一个投票：${poll.question}\n选项：\n${options}`;
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
  const [preferences, setPreferences] = useState<UserPreferences>({
    fanNotificationsEnabled: false,
    autoTranslateEnabled: false
  });
  const [hiddenMessageIds, setHiddenMessageIds] = useState<string[]>([]);

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
          const localAvatar = await AsyncStorage.getItem(LOCAL_PROFILE_AVATAR_KEY);
          if (cancelled) return;
          if (data.profile) {
            const shouldUseLocalAvatar = localAvatar && !isRemoteMediaUri(data.profile.avatar);
            setMyProfile(shouldUseLocalAvatar ? { ...data.profile, avatar: localAvatar } : data.profile);
          }
          setRecommendedArtists(data.recommendedArtists?.length ? data.recommendedArtists : initialRecommendedArtists);
          setAddedArtists(data.addedArtists ?? []);
          setSelfMessages(data.selfMessages ?? []);
          setFanMessages(data.fanMessages ?? []);
          setIdolThreads(data.idolThreads ?? []);
        }
        if (growth) setGrowthStats(growth);
        const account = await apiFetchMe();
        if (!cancelled && account?.preferences) setPreferences(account.preferences);
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
    const applyBootstrapData = (data: Awaited<ReturnType<typeof fetchBootstrap>>) => {
      if (!data) return;
      if (data.profile) setMyProfile(data.profile);
      setRecommendedArtists(data.recommendedArtists?.length ? data.recommendedArtists : initialRecommendedArtists);
      setAddedArtists(data.addedArtists ?? []);
      setSelfMessages(data.selfMessages ?? []);
      setFanMessages(data.fanMessages ?? []);
      setIdolThreads(data.idolThreads ?? []);
    };

    const refreshPreferences = async () => {
      const account = await apiFetchMe();
      if (account?.preferences) setPreferences(account.preferences);
    };

    const updateProfile = async (profile: Profile) => {
      const savedProfile = await apiUpdateProfile(profile);
      setMyProfile(savedProfile);
      if (isLocalMediaUri(savedProfile.avatar)) {
        void AsyncStorage.setItem(LOCAL_PROFILE_AVATAR_KEY, savedProfile.avatar);
      } else {
        void AsyncStorage.removeItem(LOCAL_PROFILE_AVATAR_KEY);
      }
      return savedProfile;
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

    const hideMessage = (messageId: string) => {
      setHiddenMessageIds((current) =>
        current.includes(messageId) ? current : [...current, messageId]
      );
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
        audioDurationMs: options.audioDurationMs,
        imageCaption: options.imageCaption,
        quotedFanMessage: options.quotedFanMessage ?? quotedFanMessage ?? undefined
      };
      setSelfMessages((current) => [...current, message]);
      void apiCreateSelfMessage(message);
      setQuotedFanMessage(null);
      return message;
    };

    const sendPoll = (input: { question: string; options: string[]; durationMinutes: number }) => {
      const cleanOptions = input.options.map((option) => option.trim()).filter(Boolean).slice(0, 4);
      if (!input.question.trim() || cleanOptions.length < 2) {
        throw new Error("投票需要问题和至少 2 个选项。");
      }
      const poll = simulatePoll(input.question.trim(), cleanOptions, input.durationMinutes, growthStats?.followers ?? 1200);
      const message: ChatMessage = {
        id: poll.id,
        sender: "self",
        type: "poll",
        text: poll.question,
        status: "pending",
        createdAt: poll.createdAt,
        poll
      };

      setSelfMessages((current) => [...current, message]);
      void apiCreateSelfMessage(message);
      return message;
    };

    const confirmSelfMessage = async (messageId: string) => {
      const target = selfMessages.find((message) => message.id === messageId);
      if (!target) return;

      const quotedContent = target.quotedFanMessage?.content;

      if (target.attachmentType === "voice") {
        if (!target.attachmentUri) {
          throw new Error("语音文件不存在，请重新录制。");
        }
        const audioUpload = await uploadAudioToOss(target.attachmentUri, { retries: 2 });
        const voicePayload = {
          audioUrl: audioUpload.url,
          mimeType: audioUpload.mimeType,
          filename: target.id,
          durationMs: target.audioDurationMs,
          sourceMessageId: target.id,
          quotedContent,
          imageCaption: target.imageCaption
        };
        const recognizedText = await transcribeVoiceMessage(voicePayload);
        const sentMessage = {
          ...target,
          text: recognizedText,
          recognizedText,
          attachmentUri: audioUpload.url,
          status: "sent" as const
        };

        await apiCreateSelfMessage(sentMessage);
        const statusResult = await apiUpdateSelfMessageStatus(messageId, "sent");
        if (!statusResult.ok) {
          throw new Error(statusResult.message || "发送失败，请稍后再试。");
        }

        setSelfMessages((current) =>
          current.map((message) => message.id === messageId ? sentMessage : message)
        );
        setLastIdolMessage(recognizedText);
        void generateReactionBurstFromAudio({
          ...voicePayload,
          count: 40
        }).then((result) => {
          reactionQueue.current = [...reactionQueue.current, ...result.fanMessages];
        });
        void fetchGrowthStats().then((stats) => {
          if (stats) setGrowthStats(stats);
        });
        return;
      }

      await apiCreateSelfMessage({ ...target, status: target.status || "pending" });

      const statusResult = await apiUpdateSelfMessageStatus(messageId, "sent");
      if (!statusResult.ok) {
        throw new Error(statusResult.message || "发送失败，请稍后再试。");
      }

      if (target.type === "poll" && target.poll) {
        const sentPoll = { ...target.poll, liveStartedAt: toIsoNow() };
        await apiCreateSelfMessage({ ...target, poll: sentPoll, status: "sent" });
        setSelfMessages((current) =>
          current.map((message) => {
            if (message.id !== messageId) return message;
            return { ...message, poll: sentPoll, status: "sent" };
          })
        );
        const reactionText = pollReactionText(sentPoll);
        setLastIdolMessage(reactionText);
        const pollReactions = generateFanMessagesAfterPoll(sentPoll, 16, target.id);
        reactionQueue.current = [...reactionQueue.current, ...pollReactions];
        void generateReactionBurst(reactionText, target.id, 24).then((burst) => {
          reactionQueue.current = [...reactionQueue.current, ...burst];
          void apiCreateFanMessages([...pollReactions, ...burst], target.id);
        });
        void fetchGrowthStats().then((stats) => {
          if (stats) setGrowthStats(stats);
        });
        return;
      }

      setSelfMessages((current) =>
        current.map((message) => {
          if (message.id !== messageId) return message;
          return { ...message, status: "sent" };
        })
      );

      // 更新 lastIdolMessage，供 live drip 做 reaction aftershock
      setLastIdolMessage(target.text);

      // 异步生成 reaction burst，填入 reactionQueue
      // 如果这条消息引用了粉丝消息，把被引用内容也传给 AI，让粉丝能对引用做出反应
      void generateReactionBurst(target.text, target.id, 40, quotedContent, target.imageCaption).then((burst) => {
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

    const refreshSessionData = async () => {
      const [data, growth] = await Promise.all([
        fetchBootstrap(),
        fetchGrowthStats()
      ]);
      applyBootstrapData(data);
      if (growth) setGrowthStats(growth);
    };

    const sendIdolChatMessage = (artistId: string, text: string, options: SendMessageOptions = {}) => {
      const message: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: "user",
        text,
        createdAt: timeNow(),
        attachmentType: options.attachmentType,
        attachmentUri: options.attachmentUri,
        audioDurationMs: options.audioDurationMs
      };
      setIdolThreads((current) =>
        current.some((thread) => thread.artistId === artistId)
          ? current.map((thread) =>
              thread.artistId === artistId
                ? { ...thread, messages: [...thread.messages, message] }
                : thread
            )
          : [...current, { artistId, messages: [message] }]
      );
      void apiCreateIdolChatMessage(artistId, message);
      setTimeout(() => {
        receiveArtistBubbleMessage(artistId);
      }, 900 + Math.floor(Math.random() * 1400));
    };

    const receiveArtistBubbleMessage = (artistId: string) => {
      const message: ChatMessage = {
        id: `artist-${artistId}-${Date.now()}`,
        sender: "artist",
        text: generateArtistBubbleMessage(artistId),
        createdAt: timeNow()
      };
      setIdolThreads((current) =>
        current.some((thread) => thread.artistId === artistId)
          ? current.map((thread) =>
              thread.artistId === artistId
                ? { ...thread, messages: [...thread.messages, message] }
                : thread
            )
          : [...current, { artistId, messages: [message] }]
      );
      void apiCreateIdolChatMessage(artistId, message);
      return message;
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
      sendPoll,
      confirmSelfMessage,
      fanMessages,
      hiddenMessageIds,
      hideMessage,
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
      preferences,
      refreshPreferences,
      toggleFanMessageTranslation,
      idolThreads,
      sendIdolChatMessage,
      receiveArtistBubbleMessage,
      growthStats,
      refreshGrowthStats,
      refreshSessionData
    };
  }, [addedArtists, fanMessages, growthStats, hiddenMessageIds, idolThreads, isProfileComplete, isReady, lastIdolMessage, myProfile, preferences, quotedFanMessage, recommendedArtists, selfMessages, stickerUris, translatedMessageIds]);

  return <IdolModeContext.Provider value={value}>{children}</IdolModeContext.Provider>;
}

export function useIdolMode() {
  const context = useContext(IdolModeContext);
  if (!context) {
    throw new Error("useIdolMode must be used inside IdolModeProvider");
  }
  return context;
}
