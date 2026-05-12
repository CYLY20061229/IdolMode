import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import ChatBubble from "@/components/ChatBubble";
import FanEmojiBubble from "@/components/FanEmojiBubble";
import FanMessageTicker from "@/components/FanMessageTicker";
import IconButton from "@/components/IconButton";
import QuoteComposerPreview from "@/components/QuoteComposerPreview";
import StickerTray from "@/components/StickerTray";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";
import { pickLocalImage } from "@/services/localMedia";

export default function SelfChatScreen() {
  const {
    myProfile,
    selfMessages,
    sendSelfDraft,
    fanMessages,
    quotedFanMessage,
    clearQuotedFanMessage,
    stickerUris,
    addSticker,
    growthStats
  } = useIdolMode();
  const [text, setText] = useState("");
  const [showStickers, setShowStickers] = useState(false);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const message = sendSelfDraft(trimmed);
    setText("");
    router.push({ pathname: "/confirm-send", params: { messageId: message.id } });
  };

  const sendBackground = async () => {
    const uri = await pickLocalImage();
    if (!uri) return;
    const message = sendSelfDraft(text.trim() || "发送了一张背景图", {
      attachmentType: "background",
      attachmentUri: uri
    });
    setText("");
    router.push({ pathname: "/confirm-send", params: { messageId: message.id } });
  };

  const sendSticker = (uri: string) => {
    const message = sendSelfDraft("发送了一个表情包", {
      attachmentType: "sticker",
      attachmentUri: uri
    });
    setShowStickers(false);
    router.push({ pathname: "/confirm-send", params: { messageId: message.id } });
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="返回" onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} backgroundColor={colors.nightCard} color={colors.card} />
        <View style={styles.headerText}>
          <Text style={styles.name}>{myProfile.nickname}</Text>
          <Text style={styles.mode}>艺人模式</Text>
        </View>
        <View style={styles.headerRight}>
          {growthStats !== null && (
            <View style={styles.hud}>
              <View style={styles.hudTopRow}>
                <Text style={styles.hudTitle}>营业值</Text>
                {growthStats.streakDays >= 2 && (
                  <Text style={styles.hudStreak}>🔥{growthStats.streakDays}</Text>
                )}
              </View>
              <View style={styles.hudBarTrack}>
                <View
                  style={[
                    styles.hudBarFill,
                    { width: `${Math.min(growthStats.dailyBusinessValue, 100)}%` as `${number}%` }
                  ]}
                />
              </View>
              <Text style={styles.hudLabel}>
                {growthStats.dailyBusinessValue}
                <Text style={styles.hudMax}>/100</Text>
              </Text>
            </View>
          )}
          <IconButton name="mail-open-outline" accessibilityLabel="粉丝消息" onPress={() => router.push("/fan-messages")} backgroundColor={colors.nightCard} color={colors.card} />
        </View>
      </View>

      {/* 轮播消息条固定在 header 下方，不随消息列表滚动 */}
      <FanMessageTicker messages={fanMessages} onPressMessage={() => router.push("/fan-messages")} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.messages}>
        {selfMessages.map((message) =>
          message.sender === "fan" ? (
            <FanEmojiBubble
              key={message.id}
              onPress={() => router.push("/fan-messages")}
            />
          ) : (
            <ChatBubble
              key={message.id}
              text={message.text}
              side="right"
              time={message.createdAt}
              status={message.status === "pending" ? "未确认发送" : undefined}
              dark
              attachmentType={message.attachmentType}
              attachmentUri={message.attachmentUri}
              quotedFanMessage={message.quotedFanMessage}
              onArrowPress={() => router.push({ pathname: "/confirm-send", params: { messageId: message.id } })}
            />
          )
        )}
      </ScrollView>

      <View style={styles.composer}>
        {quotedFanMessage ? <QuoteComposerPreview quote={quotedFanMessage} onClear={clearQuotedFanMessage} dark /> : null}
        <View style={styles.composerRow}>
        <Pressable style={styles.smallIcon} onPress={() => setShowStickers((value) => !value)}>
          <Ionicons name="happy-outline" size={21} color={colors.mutedText} />
        </Pressable>
        <Pressable style={styles.smallIcon} onPress={sendBackground}>
          <Ionicons name="image-outline" size={21} color={colors.mutedText} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="写一条 bubble 营业..."
          placeholderTextColor="#A99CB6"
          style={styles.input}
          multiline
        />
        <Pressable onPress={send} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
          <Ionicons name="send" size={18} color={colors.card} />
        </Pressable>
        </View>
        {showStickers ? (
          <StickerTray stickerUris={stickerUris} onAddSticker={addSticker} onSendSticker={sendSticker} dark />
        ) : null}
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  hud: {
    alignItems: "flex-end",
    gap: 3
  },
  hudTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  hudTitle: {
    color: "#BEB2CF",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3
  },
  hudBarTrack: {
    width: 64,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3A2F50",
    overflow: "hidden"
  },
  hudBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary
  },
  hudLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 13
  },
  hudMax: {
    color: "#7A6A90",
    fontSize: 10,
    fontWeight: "400"
  },
  hudStreak: {
    fontSize: 10,
    lineHeight: 12,
    color: "#FFB347"
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
    gap: 8,
    padding: 14,
    paddingBottom: 30,
    backgroundColor: "#1D1728",
    borderTopWidth: 1,
    borderTopColor: "#302640"
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8
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
