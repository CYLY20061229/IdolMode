import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { FanMessage } from "@/types/idol";

type FanMessageTickerProps = {
  messages: FanMessage[];
  onPressMessage?: () => void;
};

export default function FanMessageTicker({ messages, onPressMessage }: FanMessageTickerProps) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // 取最新的消息做轮播（最后 20 条里循环）
  const pool = messages.slice(-20);

  useEffect(() => {
    if (pool.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % pool.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [pool.length]);

  // 展开时显示最新 5 条（倒序：最新在最上面）
  const latest5 = messages.slice(-5).reverse();
  const current = pool[index % Math.max(pool.length, 1)];

  if (messages.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {/* 收起状态：单行轮播，点击展开 */}
      {!expanded && (
        <Pressable onPress={() => setExpanded(true)} style={styles.collapsed}>
          <Text style={styles.title}>来自粉丝</Text>
          <View style={styles.tickerRow}>
            {current && (
              <>
                <Text style={styles.fan}>{current.fanName}</Text>
                <Text numberOfLines={1} style={styles.content}>{current.content}</Text>
              </>
            )}
          </View>
          <Ionicons name="chevron-down" size={16} color={colors.primaryDeep} />
        </Pressable>
      )}

      {/* 展开状态：最新 5 条 + 关闭按钮 */}
      {expanded && (
        <View>
          <View style={styles.expandedHeader}>
            <Text style={styles.title}>来自粉丝 · 最新</Text>
            <Pressable onPress={() => setExpanded(false)} hitSlop={8}>
              <Ionicons name="chevron-up" size={16} color={colors.primaryDeep} />
            </Pressable>
          </View>
          <View style={styles.list}>
            {latest5.map((message) => (
              <Pressable key={message.id} onPress={onPressMessage} style={styles.line}>
                <Text style={styles.fan}>{message.fanName}</Text>
                <Text numberOfLines={2} style={styles.content}>{message.content}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={onPressMessage} style={styles.viewAll}>
            <Text style={styles.viewAllText}>查看全部粉丝消息</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.primaryDeep} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#F7F1FF",
    borderColor: "rgba(191,167,242,0.45)",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginHorizontal: 20,
    marginBottom: 8
  },
  collapsed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  tickerRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    overflow: "hidden"
  },
  expandedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  title: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: "900",
    flexShrink: 0
  },
  list: {
    gap: 6
  },
  line: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start"
  },
  fan: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    flexShrink: 0
  },
  content: {
    color: colors.mutedText,
    fontSize: 12,
    flex: 1,
    flexShrink: 1
  },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    alignSelf: "flex-end"
  },
  viewAllText: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: "700"
  }
});
