import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";

// 可爱的轮播 emoji 池
const EMOJI_POOL = ["🌸", "💜", "✨", "🥹", "🫶", "💫", "🌟", "🎀", "🍬", "🌈"];

type FanEmojiBubbleProps = {
  onPress?: () => void;
};

export default function FanEmojiBubble({ onPress }: FanEmojiBubbleProps) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * EMOJI_POOL.length));

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % EMOJI_POOL.length);
    }, 900);
    return () => clearInterval(timer);
  }, []);

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.bubble}>
        <Text style={styles.label}>来自粉丝</Text>
        <Text style={styles.emoji}>{EMOJI_POOL[index]}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginVertical: 6
  },
  bubble: {
    backgroundColor: colors.nightCard,
    borderRadius: 24,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: "center",
    gap: 4,
    minWidth: 80
  },
  label: {
    color: colors.primaryDeep,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  emoji: {
    fontSize: 28,
    lineHeight: 34
  }
});
