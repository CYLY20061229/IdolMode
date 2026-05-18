import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { router } from "expo-router";
import FanMessageCard from "@/components/FanMessageCard";
import IconButton from "@/components/IconButton";
import PrimaryButton from "@/components/PrimaryButton";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";
import { fetchHistoryBurst, generateLiveBatch } from "@/services/fanMessageApi";
import { generateLiveFanMessage as mockLiveFanMessage } from "@/services/mockData";
import { FanMessage } from "@/types/idol";


import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
// 随机间隔：发完营业后优先让 reaction 慢慢涌出来；平时 ambient 降低频率，避免盖过回应感。
function randomInterval(hasReaction: boolean, hasRecentIdolMessage: boolean): number {
  if (hasReaction) return 900 + Math.floor(Math.random() * 700);
  if (hasRecentIdolMessage) return 2400 + Math.floor(Math.random() * 1800);
  return 1400 + Math.floor(Math.random() * 1600);
}

// 去重：检查 content 是否在最近 N 条里出现过
function isDuplicateContent(msg: FanMessage, recent: FanMessage[], window = 30): boolean {
  return recent.slice(-window).some((m) => m.content === msg.content);
}

// 去重：最近 20 条里同 fanName 出现超过 2 次
function isFanNameOverused(msg: FanMessage, recent: FanMessage[], window = 20, limit = 2): boolean {
  const count = recent.slice(-window).filter((m) => m.fanName === msg.fanName).length;
  return count >= limit;
}

// 去重：最近 10 条里同 personaType 出现超过 3 次
function isPersonaOverused(msg: FanMessage, recent: FanMessage[], window = 10, limit = 3): boolean {
  if (!msg.personaType) return false;
  const count = recent.slice(-window).filter((m) => m.personaType === msg.personaType).length;
  return count >= limit;
}

// 不要连续 3 条相同 language
function isSameLanguageStreak(msg: FanMessage, recent: FanMessage[], streak = 3): boolean {
  const tail = recent.slice(-streak);
  return tail.length === streak && tail.every((m) => m.language === msg.language);
}

function shouldSkip(msg: FanMessage, recent: FanMessage[]): boolean {
  return (
    isDuplicateContent(msg, recent) ||
    isFanNameOverused(msg, recent) ||
    isPersonaOverused(msg, recent) ||
    isSameLanguageStreak(msg, recent)
  );
}
const READ_POSITION_KEY = "idol_mode_read_position:fan-messages";
const LAST_READ_JUMP_VISIBLE_MS = 4000;
export default function FanMessagesScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [selectedMessage, setSelectedMessage] = useState<FanMessage | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);
  const previousMessageCount = useRef(0);

// 上次结束位置
const itemLayoutsRef = useRef<Record<string, number>>({});
const latestVisibleMessageIdRef = useRef<string | null>(null);
const [jumpTargetId, setJumpTargetId] = useState<string | null>(null);
const [showLastReadJump, setShowLastReadJump] = useState(false);
  
const lastReadJumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 三个队列
  const reactionQueue = useRef<FanMessage[]>([]);
  const liveQueue = useRef<FanMessage[]>([]);
  const historyQueue = useRef<FanMessage[]>([]);

  const liveRequestInFlight = useRef(false);
  const lastLiveFetchAt = useRef(0); // 上次预取时间戳，防止 429
  const hasBurst = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 持有最新 scheduleNext，供 sync interval 在打断 timer 后立即重新调度
  const scheduleNextRef = useRef<(() => void) | null>(null);

  // 用 ref 追踪最新 fanMessages，避免 timer effect 因 fanMessages 变化而重建
  const fanMessagesRef = useRef<FanMessage[]>([]);
  // 用 ref 持有最新 appendLiveFanMessages，避免 drip timer effect 因函数引用变化而重建
  const appendLiveFanMessagesRef = useRef<((messages: FanMessage[]) => void) | null>(null);
  // 用 ref 持有最新 lastIdolMessage，供 fetchLiveBatch 闭包读取，避免 useCallback 依赖变化
  const lastIdolMessageRef = useRef<string | undefined>(undefined);

  const {
    fanMessages,
    appendLiveFanMessages,
    prependHistoryFanMessages,
    lastIdolMessage,
    reactionQueue: contextReactionQueue,
    translatedMessageIds,
    preferences,
    toggleFanMessageTranslation,
    quoteFanMessage
  } = useIdolMode();

  const returnToChat = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/self-chat");
  };
const showLastReadJumpTemporarily = () => {
  setShowLastReadJump(true);

  if (lastReadJumpTimerRef.current) {
    clearTimeout(lastReadJumpTimerRef.current);
  }

  lastReadJumpTimerRef.current = setTimeout(() => {
    setShowLastReadJump(false);
    lastReadJumpTimerRef.current = null;
  }, LAST_READ_JUMP_VISIBLE_MS);
};


const hideLastReadJump = () => {
  setShowLastReadJump(false);

  if (lastReadJumpTimerRef.current) {
    clearTimeout(lastReadJumpTimerRef.current);
    lastReadJumpTimerRef.current = null;
  }
};
const scrollToLatest = (animated = true) => {
  scrollRef.current?.scrollToEnd({ animated });
  isNearBottomRef.current = true;
  setIsNearBottom(true);
  setUnreadCount(0);
};

  const jumpToLastReadPosition = () => {
  if (!jumpTargetId) return;

  const y = itemLayoutsRef.current[jumpTargetId];

  if (typeof y !== "number") {
    setShowLastReadJump(false);
    return;
  }

  scrollRef.current?.scrollTo({
    y: Math.max(0, y - 24),
    animated: true,
  });

 setShowLastReadJump(false);

if (lastReadJumpTimerRef.current) {
  clearTimeout(lastReadJumpTimerRef.current);
  lastReadJumpTimerRef.current = null;
}
};

  // const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
  //   const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
  //   const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
  //   const nextIsNearBottom = distanceFromBottom < 120;
  //   if (nextIsNearBottom !== isNearBottomRef.current) {
  //     isNearBottomRef.current = nextIsNearBottom;
  //     setIsNearBottom(nextIsNearBottom);
  //   }
  //   if (nextIsNearBottom && unreadCount > 0) {
  //     setUnreadCount(0);
  //   }
  // };
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
  const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
  const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
  const nextIsNearBottom = distanceFromBottom < 120;

  if (nextIsNearBottom !== isNearBottomRef.current) {
    isNearBottomRef.current = nextIsNearBottom;
    setIsNearBottom(nextIsNearBottom);
  }

  if (nextIsNearBottom && unreadCount > 0) {
    setUnreadCount(0);
  }

  // 记录当前大概读到哪条消息
  const readLine = contentOffset.y + layoutMeasurement.height * 0.7;
  let currentReadId: string | null = null;

  for (const message of fanMessagesRef.current) {
    const y = itemLayoutsRef.current[message.id];
    if (typeof y === "number" && y <= readLine) {
      currentReadId = message.id;
    }
  }

  if (currentReadId) {
    latestVisibleMessageIdRef.current = currentReadId;
  }
};

  // 每次渲染时同步最新引用到 ref，timer 闭包通过 ref 调用，永远拿到最新版本
  fanMessagesRef.current = fanMessages;
  appendLiveFanMessagesRef.current = appendLiveFanMessages;
  lastIdolMessageRef.current = lastIdolMessage;


  useEffect(() => {
  let cancelled = false;

  async function loadReadPosition() {
    try {
      const savedMessageId = await AsyncStorage.getItem(READ_POSITION_KEY);
      if (cancelled) return;

   if (savedMessageId) {
  setJumpTargetId(savedMessageId);
  showLastReadJumpTemporarily();
}
    } catch {
      if (!cancelled) {
        setJumpTargetId(null);
        setShowLastReadJump(false);
      }
    }
  }

  void loadReadPosition();

  return () => {
    cancelled = true;
  };
}, []);

useFocusEffect(
  useCallback(() => {
    return () => {
      const id = latestVisibleMessageIdRef.current;
      if (!id) return;

      void AsyncStorage.setItem(READ_POSITION_KEY, id);
    };
  }, [])
);

  // ── History burst：进入页面时补一点底噪，但不要一口气盖过 reaction ──
  useEffect(() => {
    if (hasBurst.current) return;
    hasBurst.current = true;

    const runBurst = async () => {
      const messages = await fetchHistoryBurst(16);
      if (messages.length === 0) return;

      const immediate = messages.slice(0, 6);
      const queued = messages.slice(6);

      prependHistoryFanMessages(immediate);
      historyQueue.current = [...historyQueue.current, ...queued];

      setTimeout(() => {
        scrollToLatest(false);
      }, 120);
    };

    void runBurst();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 预取 live batch ──
  // 调用 /ai/live-batch 拉 ambient 消息（从 PG pool 取，不调 AI）
  // 队列 < 3 条时触发下一次预取
  // 最小预取间隔 45s，防止 429（服务端 live_batch 限流 60次/分钟）
  const LIVE_FETCH_COOLDOWN_MS = 60_000;

  const fetchLiveBatch = useCallback(async () => {
    if (liveRequestInFlight.current) return;
    const now = Date.now();
    if (now - lastLiveFetchAt.current < LIVE_FETCH_COOLDOWN_MS) return;
    liveRequestInFlight.current = true;
    lastLiveFetchAt.current = now;
    try {
      const messages = await generateLiveBatch(lastIdolMessageRef.current, 12);
      liveQueue.current = [...liveQueue.current, ...messages];
    } finally {
      liveRequestInFlight.current = false;
    }
  }, []);

  // ── 从 context reactionQueue 同步到本地 reactionQueue ──
  // context 里的 reactionQueue ref 由 confirmSelfMessage 填入
  // mount 时立即检查一次（AI 可能在进入页面前就已返回）
  // S2: burst 到达时，前 5 条立即显示，剩余放入 reactionQueue 逐条 drip
  useEffect(() => {
    const kickDrip = () => {
      // 打断当前 ambient timer，立即以 reaction 模式重新调度
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      scheduleNextRef.current?.();
    };

    const consumeContextQueue = () => {
      if (contextReactionQueue.current.length === 0) return;
      const incoming = contextReactionQueue.current;
      contextReactionQueue.current = [];

      // 前 5 条立即显示（爆发感），其余放入 drip 队列，形成持续回应。
      const immediate = incoming.slice(0, 5);
      const queued = incoming.slice(5);
      if (immediate.length > 0) {
        appendLiveFanMessagesRef.current?.(immediate);
      }
      if (queued.length > 0) {
        reactionQueue.current = [...reactionQueue.current, ...queued];
        kickDrip();
      }
    };

    // 立即同步一次，避免 AI 在进入页面前返回时错过
    consumeContextQueue();

    const sync = setInterval(() => {
      consumeContextQueue();
    }, 200);
    return () => clearInterval(sync);
  }, [contextReactionQueue]);

  // 连续跳过计数，防止去重过滤死循环
  const skipStreak = useRef(0);
useEffect(() => {
  return () => {
    if (lastReadJumpTimerRef.current) {
      clearTimeout(lastReadJumpTimerRef.current);
      lastReadJumpTimerRef.current = null;
    }
  };
}, []);
  // ── Live drip：随机间隔，优先级 reaction > live > history ──
  // 依赖只有 fetchLiveBatch（useCallback 稳定引用）。
  // appendLiveFanMessages 通过 appendLiveFanMessagesRef 调用，避免每次 fanMessages
  // 变化导致 useMemo 重新执行、函数引用更新、effect 重建、timer 被清除的死循环。
  useEffect(() => {
    // 初始预取
    void fetchLiveBatch();

    const scheduleNext = () => {
      // 如果已有 timer 在跑（外部没有清除），先清掉再重新调度，防止双重 timer
      if (timerRef.current) clearTimeout(timerRef.current);

      const hasReaction = reactionQueue.current.length > 0;
      const hasRecentIdolMessage = Boolean(lastIdolMessageRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;

        // 选下一条消息：优先级 reactionQueue > liveQueue > historyQueue
        let next: FanMessage | undefined;

        if (reactionQueue.current.length > 0) {
          next = reactionQueue.current.shift();
        } else if (liveQueue.current.length > 0) {
          next = liveQueue.current.shift();
        } else if (historyQueue.current.length > 0) {
          next = historyQueue.current.shift();
        } else {
          // 三队列全空：用本地 mock fallback 保证消息不断流
          next = mockLiveFanMessage(lastIdolMessageRef.current);
          next = { ...next, id: `local-fallback-${Date.now()}` };
        }

        if (next) {
          // reaction 消息强制放行（跳过去重），保证用户能看到回应
          const isReaction = next.messageKind === "reaction";
          const forceShow = isReaction || skipStreak.current >= 5;
          if (forceShow || !shouldSkip(next, fanMessagesRef.current)) {
            // 通过 ref 调用，避免闭包捕获旧引用导致 effect 重建
            appendLiveFanMessagesRef.current?.([next]);
            skipStreak.current = 0;
          } else {
            skipStreak.current += 1;
          }
        }

        // liveQueue 少于 3 条时预取，ambient 只做底噪，不抢 reaction 存在感。
        if (liveQueue.current.length < 3) {
          void fetchLiveBatch();
        }

        scheduleNext();
      }, randomInterval(hasReaction, hasRecentIdolMessage));
    };

    // 注册到 ref，供 sync interval 在打断 timer 后立即重新调度
    scheduleNextRef.current = scheduleNext;

    scheduleNext();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      scheduleNextRef.current = null;
    };
  }, [fetchLiveBatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 新消息追加后：只在用户本来就在底部附近时自动滚动 ──
  useEffect(() => {
    const previousCount = previousMessageCount.current;
    previousMessageCount.current = fanMessages.length;
    const addedCount = Math.max(0, fanMessages.length - previousCount);
    if (addedCount === 0) return;

    const timer = setTimeout(() => {
      if (isNearBottomRef.current) {
        scrollToLatest(true);
      } else {
        setUnreadCount((count) => count + addedCount);
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [fanMessages.length]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="返回" onPress={() => router.back()} />
        <View style={styles.titleWrap}>
          <Text style={styles.title}>粉丝消息</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>实时</Text>
          </View>
        </View>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={80}
      >
        {/* {fanMessages.map((message) => (
          <FanMessageCard
            key={message.id}
            message={message}
            translated={preferences.autoTranslateEnabled
              ? !translatedMessageIds.includes(message.id)
              : translatedMessageIds.includes(message.id)}
            onTranslate={() => toggleFanMessageTranslation(message.id)}
            onLongPress={() => setSelectedMessage(message)}
          />
        ))} */}
        {fanMessages.map((message) => (
  <View
    key={message.id}
    onLayout={(event) => {
      itemLayoutsRef.current[message.id] = event.nativeEvent.layout.y;
    }}
  >
    {message.id === jumpTargetId ? (
      <View style={styles.lastReadMarker}>
        <Text style={styles.lastReadMarkerText}>上次结束位置</Text>
      </View>
    ) : null}

    <FanMessageCard
      message={message}
      translated={preferences.autoTranslateEnabled
        ? !translatedMessageIds.includes(message.id)
        : translatedMessageIds.includes(message.id)}
      onTranslate={() => toggleFanMessageTranslation(message.id)}
      onLongPress={() => setSelectedMessage(message)}
    />
  </View>
))}

      </ScrollView>

      {unreadCount > 0 && !isNearBottom ? (
        <Pressable onPress={() => scrollToLatest(true)} style={styles.unreadButton}>
          <Text style={styles.unreadText}>新消息 {unreadCount} 条</Text>
        </Pressable>
      ) : null}
{showLastReadJump && jumpTargetId ? (
  <Pressable
    onPress={jumpToLastReadPosition}
    style={({ pressed }) => [
      styles.lastReadJumpButton,
      pressed && styles.lastReadJumpButtonPressed
    ]}
  >
    <Text style={styles.lastReadJumpText}>跳转到上次结束位置</Text>
  </Pressable>
) : null}
      <Modal visible={Boolean(selectedMessage)} transparent animationType="fade" onRequestClose={() => setSelectedMessage(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedMessage(null)}>
          <Pressable style={styles.quoteSheet}>
            <Text style={styles.quoteTitle}>引用这条粉丝消息？</Text>
            <Text numberOfLines={3} style={styles.quoteContent}>{selectedMessage?.content}</Text>
            <Pressable
              style={styles.quoteAction}
              onPress={() => {
	                if (selectedMessage) {
	                  quoteFanMessage(selectedMessage);
	                  setSelectedMessage(null);
	                  returnToChat();
	                }
	              }}
            >
              <Text style={styles.quoteActionText}>引用并回复</Text>
            </Pressable>
            <Pressable style={styles.cancelAction} onPress={() => setSelectedMessage(null)}>
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.footer}>
        <PrimaryButton title="回到聊天" onPress={returnToChat} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 54,
    paddingHorizontal: spacing.screen
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  titleWrap: {
    alignItems: "center",
    gap: 4
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger
  },
  liveText: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: "900"
  },
  spacer: {
    width: 38
  },
  content: {
    paddingTop: 22,
    paddingBottom: 114,
    gap: 12
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingBottom: 34,
    backgroundColor: "rgba(255,249,251,0.96)"
  },
  unreadButton: {
    position: "absolute",
    alignSelf: "center",
    bottom: 102,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
    backgroundColor: colors.primaryDeep,
    shadowColor: "#7A5DB7",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3
  },
  unreadText: {
    color: colors.card,
    fontSize: 13,
    fontWeight: "900"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(47,42,53,0.28)",
    justifyContent: "flex-end",
    padding: 18
  },
  quoteSheet: {
    backgroundColor: colors.card,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12
  },
  quoteTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  quoteContent: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 12
  },
  quoteAction: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  quoteActionText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: "900"
  },
  cancelAction: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  cancelText: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "800"
  },
  lastReadMarker: {
  alignSelf: "center",
  paddingHorizontal: 12,
  paddingVertical: 4,
  borderRadius: 999,
  backgroundColor: colors.background,
  borderWidth: 1,
  borderColor: colors.border,
  marginBottom: 8
},
lastReadMarkerText: {
  color: colors.mutedText,
  fontSize: 11,
  fontWeight: "800"
},
lastReadJumpButton: {
  position: "absolute",
  alignSelf: "center",
  bottom: 154,
  borderRadius: 999,
  paddingHorizontal: 15,
  paddingVertical: 9,
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.border,
  shadowColor: "#7A5DB7",
  shadowOpacity: 0.18,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 },
  elevation: 3
},
lastReadJumpButtonPressed: {
  opacity: 0.75
},
lastReadJumpText: {
  color: colors.primaryDeep,
  fontSize: 13,
  fontWeight: "900"
},
});
