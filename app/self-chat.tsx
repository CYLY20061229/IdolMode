import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import ChatBubble from "@/components/ChatBubble";
import FanMessageTicker from "@/components/FanMessageTicker";
import IconButton from "@/components/IconButton";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";

export default function SelfChatScreen() {
  const { myProfile, selfMessages, sendSelfDraft, fanMessages } = useIdolMode();
  const [text, setText] = useState("");

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const message = sendSelfDraft(trimmed);
    setText("");
    router.push({ pathname: "/confirm-send", params: { messageId: message.id } });
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => router.back()} backgroundColor={colors.nightCard} color={colors.card} />
        <View style={styles.headerText}>
          <Text style={styles.name}>{myProfile.nickname}</Text>
          <Text style={styles.mode}>artist mode</Text>
        </View>
        <IconButton name="mail-open-outline" accessibilityLabel="Fan messages" onPress={() => router.push("/fan-messages")} backgroundColor={colors.nightCard} color={colors.card} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.messages}>
        <FanMessageTicker messages={fanMessages} onPressMessage={() => router.push("/fan-messages")} />
        {selfMessages.map((message) => (
          <ChatBubble
            key={message.id}
            text={message.text}
            side={message.sender === "self" ? "right" : "left"}
            time={message.createdAt}
            status={message.status === "pending" ? "unconfirmed" : undefined}
            dark
            onArrowPress={
              message.sender === "self"
                ? () => router.push({ pathname: "/confirm-send", params: { messageId: message.id } })
                : () => router.push("/fan-messages")
            }
          />
        ))}
      </ScrollView>

      <View style={styles.composer}>
        <Pressable style={styles.smallIcon}>
          <Ionicons name="happy-outline" size={21} color={colors.mutedText} />
        </Pressable>
        <Pressable style={styles.smallIcon}>
          <Ionicons name="image-outline" size={21} color={colors.mutedText} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write a bubble update..."
          placeholderTextColor="#A99CB6"
          style={styles.input}
          multiline
        />
        <Pressable onPress={send} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
          <Ionicons name="send" size={18} color={colors.card} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.night,
    paddingTop: 54
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screen,
    paddingBottom: 12
  },
  headerText: {
    alignItems: "center"
  },
  name: {
    color: colors.card,
    fontSize: 18,
    fontWeight: "900"
  },
  mode: {
    color: "#BEB2CF",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2
  },
  messages: {
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
    paddingBottom: 118
  },
  composer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 14,
    paddingBottom: 30,
    backgroundColor: "#1D1728",
    borderTopWidth: 1,
    borderTopColor: "#302640"
  },
  smallIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.nightCard
  },
  input: {
    flex: 1,
    maxHeight: 92,
    minHeight: 42,
    borderRadius: 21,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: colors.nightCard,
    color: colors.card,
    fontSize: 15
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.75
  }
});
