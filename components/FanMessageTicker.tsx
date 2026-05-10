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

  useEffect(() => {
    if (messages.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [messages.length]);

  const current = messages[index % Math.max(messages.length, 1)];
  const visible = expanded ? messages.slice(0, 5) : current ? [current] : [];

  return (
    <Pressable onPress={() => setExpanded((value) => !value)} style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>FROM FAN</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.primaryDeep} />
      </View>
      <View style={styles.list}>
        {visible.map((message) => (
          <Pressable key={message.id} onPress={onPressMessage} style={styles.line}>
            <Text style={styles.fan}>{message.fanName}</Text>
            <Text numberOfLines={1} style={styles.content}>{message.content}</Text>
          </Pressable>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#F7F1FF",
    borderColor: "rgba(191,167,242,0.45)",
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5
  },
  title: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: "900"
  },
  list: {
    gap: 5
  },
  line: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  fan: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    minWidth: 54
  },
  content: {
    color: colors.mutedText,
    fontSize: 12,
    flex: 1
  }
});
