import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import ChatBubble from "@/components/ChatBubble";
import IconButton from "@/components/IconButton";
import PrimaryButton from "@/components/PrimaryButton";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";

export default function ConfirmSendScreen() {
  const { messageId } = useLocalSearchParams<{ messageId: string }>();
  const { selfMessages, confirmSelfMessage, myProfile } = useIdolMode();
  const [sending, setSending] = useState(false);
  const message = selfMessages.find((item) => item.id === messageId);
  const alreadySent = message?.status === "sent";

  const confirm = () => {
    if (!message || alreadySent) return;
    Alert.alert("Confirm Send", "Are you sure you want to send this message to your fans?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm Send",
        onPress: async () => {
          setSending(true);
          await confirmSelfMessage(message.id);
          setSending(false);
          router.replace("/self-chat");
        }
      }
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => router.back()} />
        <Text style={styles.title}>Preview</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.previewCard}>
        <Text style={styles.eyebrow}>fan view</Text>
        <Text style={styles.name}>{myProfile.nickname}</Text>
        <ChatBubble text={message?.text ?? "Message not found."} side="left" time={message?.createdAt} />
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          title={sending ? "Sending..." : alreadySent ? "Already Sent" : "Confirm Send"}
          onPress={confirm}
          disabled={!message || alreadySent || sending}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 54,
    paddingHorizontal: spacing.screen
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  spacer: {
    width: 38
  },
  previewCard: {
    marginTop: 44,
    backgroundColor: colors.card,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    minHeight: 300,
    justifyContent: "center",
    gap: 10
  },
  eyebrow: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 14
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingBottom: 34
  }
});
