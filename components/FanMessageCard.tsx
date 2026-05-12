import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { colors } from "@/constants/theme";
import { FanMessage } from "@/types/idol";

type FanMessageCardProps = {
  message: FanMessage;
  translated: boolean;
  onTranslate: () => void;
  onLongPress?: () => void;
};

// 语言标签映射
const LANG_LABEL: Record<string, string> = {
  zh: "中",
  en: "EN",
  ko: "KR",
  jp: "JP",
  es: "ES",
};

export default function FanMessageCard({ message, translated, onTranslate, onLongPress }: FanMessageCardProps) {
  const isForeign = message.language !== "zh";
  const displayText = translated && isForeign ? (message.translatedContent || message.content) : message.content;

  return (
    <Pressable onLongPress={onLongPress} delayLongPress={280} style={styles.row}>
      <Avatar label={message.avatar} size={36} backgroundColor={colors.blueSoft} />
      <View style={styles.right}>
        {/* 名字行：头像右侧，气泡上方 */}
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{message.fanName}</Text>
          {isForeign && (
            <Text style={styles.langTag}>{LANG_LABEL[message.language] ?? message.language.toUpperCase()}</Text>
          )}
        </View>
        {/* 气泡行：消息文本 + 翻译按钮 */}
        <View style={styles.bubbleRow}>
          <View style={styles.bubble}>
            <Text style={styles.message}>{displayText}</Text>
          </View>
          {/* 翻译按钮只对外文消息显示，独立于气泡外避免事件冲突 */}
          {isForeign && (
            <Pressable
              onPress={onTranslate}
              hitSlop={8}
              style={({ pressed }) => [styles.translateButton, pressed && styles.pressed]}
            >
              <Text style={styles.translateText}>{translated ? "原文" : "译"}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  right: {
    flex: 1,
    flexDirection: "column",
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingLeft: 2,
  },
  name: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  langTag: {
    color: colors.primaryDeep,
    fontSize: 10,
    fontWeight: "800",
    flexShrink: 0,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexShrink: 1,
    alignSelf: "flex-start",
  },
  message: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  translateButton: {
    borderRadius: 999,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
    marginBottom: 2,
  },
  translateText: {
    color: colors.primaryDeep,
    fontSize: 10,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.55,
  },
});
