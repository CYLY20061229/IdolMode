import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { useAppTheme } from "@/context/AppThemeContext";
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

function containsChinese(value: string) {
  return /[\u3400-\u9FFF]/.test(value);
}

export default function FanMessageCard({ message, translated, onTranslate, onLongPress }: FanMessageCardProps) {
  const theme = useAppTheme();
  const isForeign = message.language !== "zh";
const hasEffectiveTranslation = Boolean(
  message.translatedContent &&
  message.translatedContent.trim() &&
  message.translatedContent.trim() !== message.content.trim()
);
  const showMissingTranslation = translated && isForeign && !hasEffectiveTranslation;
  const displayText = translated && isForeign && hasEffectiveTranslation ? message.translatedContent : message.content;

  return (
    <Pressable onLongPress={onLongPress} delayLongPress={280} style={styles.row}>
      <Avatar label={message.avatar} size={36} backgroundColor={theme.colors.blueSoft} />
      <View style={styles.right}>
        {/* 名字行：头像右侧，气泡上方 */}
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: theme.colors.mutedText }]} numberOfLines={1}>{message.fanName}</Text>
          {isForeign && (
            <Text style={[styles.langTag, { color: theme.colors.primaryDeep }]}>{LANG_LABEL[message.language] ?? message.language.toUpperCase()}</Text>
          )}
        </View>
        {/* 气泡行：消息文本 + 翻译按钮 */}
        <View style={styles.bubbleRow}>
          <View style={[styles.bubble, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.message, { color: theme.colors.text }]}>{displayText}</Text>
            {showMissingTranslation ? (
              <Text style={[styles.missingTranslation, { color: theme.colors.mutedText }]}>暂无译文</Text>
            ) : null}
          </View>
          {/* 翻译按钮只对外文消息显示，独立于气泡外避免事件冲突 */}
          {isForeign && (
            <Pressable
              onPress={onTranslate}
              hitSlop={8}
              style={({ pressed }) => [
                styles.translateButton,
                { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.translateText, { color: theme.colors.primaryDeep }]}>{translated ? "原文" : "译"}</Text>
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
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  langTag: {
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
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexShrink: 1,
    alignSelf: "flex-start",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  missingTranslation: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: "700",
  },
  translateButton: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    flexShrink: 0,
    marginBottom: 2,
  },
  translateText: {
    fontSize: 10,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.55,
  },
});
