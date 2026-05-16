import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";

// 可爱的轮播 emoji 池
const EMOJI_POOL = ["🌸", "💜", "✨", "🥹", "🫶", "💫", "🌟", "🎀", "🍬", "🌈"];

type FanEmojiBubbleProps = {
  seed?: string;
  onPress?: () => void;
};

function indexFromSeed(seed?: string) {
  if (!seed) return Math.floor(Math.random() * EMOJI_POOL.length);
  let total = 0;
  for (let i = 0; i < seed.length; i += 1) {
    total += seed.charCodeAt(i) * (i + 1);
  }
  return total % EMOJI_POOL.length;
}

export default function FanEmojiBubble({ seed, onPress }: FanEmojiBubbleProps) {
  const [index, setIndex] = useState(() => indexFromSeed(seed));

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % EMOJI_POOL.length);
    }, 900);
    return () => clearInterval(timer);
  }, []);

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.bubble}>
        <Text style={styles.label}>FROM FAN</Text>
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
