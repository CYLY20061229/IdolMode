import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { colors } from "@/constants/theme";
import { FanMessage } from "@/types/idol";

type FanMessageCardProps = {
  message: FanMessage;
  translated: boolean;
  onTranslate: () => void;
};

export default function FanMessageCard({ message, translated, onTranslate }: FanMessageCardProps) {
  return (
    <View style={styles.row}>
      <Avatar label={message.avatar} size={38} backgroundColor={colors.blueSoft} />
      <View style={styles.bubble}>
        <View style={styles.top}>
          <View style={styles.identity}>
            <Text style={styles.name}>{message.fanName}</Text>
            <Text style={styles.language}>{message.language.toUpperCase()}</Text>
            {message.personaType ? <Text style={styles.persona}>{message.personaType}</Text> : null}
            {message.messageKind === "reaction" ? <Text style={styles.kind}>reaction</Text> : null}
          </View>
          <Pressable onPress={onTranslate} style={({ pressed }) => [styles.translateButton, pressed && styles.pressed]}>
            <Text style={styles.translateText}>{translated ? "Original" : "Translate"}</Text>
          </Pressable>
        </View>
        <Text style={styles.message}>{translated ? message.translatedContent : message.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 11
  },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 13,
    paddingVertical: 10,
    maxWidth: "82%",
    minWidth: 138,
    alignSelf: "flex-start"
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    flexShrink: 1
  },
  name: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  language: {
    color: colors.primaryDeep,
    fontSize: 10,
    fontWeight: "900"
  },
  persona: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: "800"
  },
  kind: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.secondary,
    color: colors.primaryDeep,
    fontSize: 9,
    fontWeight: "900",
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  message: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1
  },
  translateButton: {
    borderRadius: 999,
    backgroundColor: colors.background,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border
  },
  translateText: {
    color: colors.primaryDeep,
    fontSize: 10,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.65
  }
});
