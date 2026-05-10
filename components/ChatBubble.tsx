import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";

type ChatBubbleProps = {
  text: string;
  side: "left" | "right";
  time?: string;
  status?: string;
  onArrowPress?: () => void;
  dark?: boolean;
};

export default function ChatBubble({ text, side, time, status, onArrowPress, dark }: ChatBubbleProps) {
  const isRight = side === "right";
  return (
    <View style={[styles.row, isRight ? styles.rightRow : styles.leftRow]}>
      {!isRight && onArrowPress ? <Arrow onPress={onArrowPress} /> : null}
      <View
        style={[
          styles.bubble,
          isRight ? styles.rightBubble : styles.leftBubble,
          dark && !isRight && styles.darkLeftBubble
        ]}
      >
        <Text style={[styles.text, isRight ? styles.rightText : dark ? styles.darkText : styles.leftText]}>
          {text}
        </Text>
        <View style={styles.metaRow}>
          {time ? <Text style={[styles.meta, dark && !isRight && styles.darkMeta]}>{time}</Text> : null}
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </View>
      </View>
      {isRight && onArrowPress ? <Arrow onPress={onArrowPress} /> : null}
    </View>
  );
}

function Arrow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.arrow}>
      <Ionicons name="arrow-forward" size={15} color={colors.primaryDeep} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
    gap: 8
  },
  leftRow: {
    justifyContent: "flex-start"
  },
  rightRow: {
    justifyContent: "flex-end"
  },
  bubble: {
    maxWidth: "76%",
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 11
  },
  leftBubble: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 8
  },
  darkLeftBubble: {
    backgroundColor: colors.nightCard
  },
  rightBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 8
  },
  text: {
    fontSize: 15,
    lineHeight: 21
  },
  leftText: {
    color: colors.text
  },
  darkText: {
    color: colors.card
  },
  rightText: {
    color: colors.card
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 5
  },
  meta: {
    color: colors.mutedText,
    fontSize: 10
  },
  darkMeta: {
    color: "#BEB2CF"
  },
  status: {
    color: colors.card,
    fontSize: 10,
    fontWeight: "700"
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center"
  }
});
