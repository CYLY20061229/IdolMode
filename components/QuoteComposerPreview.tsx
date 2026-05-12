import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { QuotedFanMessage } from "@/types/idol";

type QuoteComposerPreviewProps = {
  quote: QuotedFanMessage;
  onClear: () => void;
  dark?: boolean;
};

export default function QuoteComposerPreview({ quote, onClear, dark }: QuoteComposerPreviewProps) {
  return (
    <View style={[styles.wrap, dark && styles.darkWrap]}>
      <View style={styles.textWrap}>
        <Text style={[styles.label, dark && styles.darkLabel]}>已引用</Text>
        <Text numberOfLines={2} style={[styles.content, dark && styles.darkContent]}>{quote.content}</Text>
      </View>
      <Pressable onPress={onClear} hitSlop={8} style={styles.close}>
        <Ionicons name="close" size={16} color={dark ? colors.card : colors.mutedText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryDeep,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 8
  },
  darkWrap: {
    backgroundColor: colors.nightCard
  },
  textWrap: {
    flex: 1,
    gap: 2
  },
  label: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: "900"
  },
  darkLabel: {
    color: "#D8C8FF"
  },
  content: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17
  },
  darkContent: {
    color: colors.card
  },
  close: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center"
  }
});
