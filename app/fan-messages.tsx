import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import FanMessageCard from "@/components/FanMessageCard";
import IconButton from "@/components/IconButton";
import PrimaryButton from "@/components/PrimaryButton";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";
import { fetchHistoryBurst, generateLiveFanMessages } from "@/services/fanMessageApi";
import { FanMessage } from "@/types/idol";

export default function FanMessagesScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const liveQueue = useRef<FanMessage[]>([]);
  const liveRequestInFlight = useRef(false);
  const hasBurst = useRef(false);
  const {
    fanMessages,
    appendLiveFanMessages,
    prependHistoryFanMessages,
    getRecentArtistMessage,
    translatedMessageIds,
    toggleFanMessageTranslation
  } = useIdolMode();

  // History burst: 进入页面时一次性插入历史消息，模拟"不在时粉丝一直在发"
  useEffect(() => {
    if (hasBurst.current) return;
    hasBurst.current = true;

    const runBurst = async () => {
      const count = 12 + Math.floor(Math.random() * 5); // 12–16 条
      const messages = await fetchHistoryBurst(count);
      if (messages.length > 0) {
        prependHistoryFanMessages(messages);
      }
      // 等 React 渲染完再滚到底部
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 120);
    };

    void runBurst();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live drip: 每 500ms 从队列取一条，队列不足时预取
  useEffect(() => {
    const fetchBatch = async () => {
      if (liveRequestInFlight.current) return;
      liveRequestInFlight.current = true;
      try {
        const messages = await generateLiveFanMessages(getRecentArtistMessage(), 8);
        liveQueue.current = [...liveQueue.current, ...messages];
      } finally {
        liveRequestInFlight.current = false;
      }
    };

    void fetchBatch();
    const timer = setInterval(() => {
      const next = liveQueue.current.shift();
      if (next) {
        appendLiveFanMessages([next]);
      }
      if (liveQueue.current.length < 4) {
        void fetchBatch();
      }
    }, 500);

    return () => clearInterval(timer);
  }, [appendLiveFanMessages, getRecentArtistMessage]);

  // 每次新消息追加后滚到底部（live drip 触发）
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [fanMessages.length]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => router.back()} />
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Fan Messages</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <View style={styles.spacer} />
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {fanMessages.map((message) => (
          <FanMessageCard
            key={message.id}
            message={message}
            translated={translatedMessageIds.includes(message.id)}
            onTranslate={() => toggleFanMessageTranslation(message.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Back to Chat" onPress={() => router.replace("/self-chat")} />
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
  }
});
