import { useRef, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
import { pickImageForChat } from "@/services/localMedia";
import { uploadImageToOss } from "@/services/uploadApi";

type ImageUploadState =
  | { status: "idle" }
  | { status: "uploading"; localUri: string; progress: number | null }
  | { status: "failed"; localUri: string; message: string }
  | { status: "uploaded"; localUri: string; remoteUri: string };

function uploadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "网络不稳定，图片还没有发送。";
}

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
  const [imageUpload, setImageUpload] = useState<ImageUploadState>({ status: "idle" });
  const uploadRunId = useRef(0);

  const send = () => {
    const trimmed = text.trim();
    if (imageUpload.status === "uploading") {
      Alert.alert("图片上传中", "图片还在上传中，请稍等或移除图片后重试。");
      return;
    }
    if (imageUpload.status === "failed") {
      Alert.alert("图片上传失败", imageUpload.message + "。你可以重试或移除图片。", [
        { text: "移除图片", onPress: () => setImageUpload({ status: "idle" }) },
        { text: "重试", style: "destructive", onPress: () => void doUploadImage(imageUpload.localUri) }
      ]);
      return;
    }
    if (!trimmed && imageUpload.status !== "uploaded") return;
    const attachment = imageUpload.status === "uploaded"
      ? { attachmentType: "background" as const, attachmentUri: imageUpload.remoteUri }
      : undefined;
    const message = sendSelfDraft(trimmed || "发送了一张图片", attachment);
    setText("");
    setImageUpload({ status: "idle" });
    router.push({ pathname: "/confirm-send", params: { messageId: message.id } });
  };

  const doUploadImage = async (localUri: string) => {
    const runId = ++uploadRunId.current;
    setImageUpload({ status: "uploading", localUri, progress: null });
    try {
      const remoteUrl = await uploadImageToOss(localUri, "chat-image", {
        onProgress: (progress) => {
          if (runId !== uploadRunId.current) return;
          setImageUpload({ status: "uploading", localUri, progress });
        },
        retries: 2
      });
      if (runId !== uploadRunId.current) return;
      setImageUpload({ status: "uploaded", localUri, remoteUri: remoteUrl });
    } catch (error) {
      if (runId !== uploadRunId.current) return;
      setImageUpload({ status: "failed", localUri, message: uploadErrorMessage(error) });
    }
  };

  const pickImage = async () => {
    const uri = await pickImageForChat();
    if (!uri) return;
    setShowStickers(false);
    void doUploadImage(uri);
  };

  const removeImage = () => setImageUpload({ status: "idle" });

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
        <IconButton name="chevron-back" accessibilityLabel="返回" onPress={() => router.replace("/chats")} backgroundColor={colors.nightCard} color={colors.card} />
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
        {imageUpload.status !== "idle" ? (
          <View style={[styles.pendingImageWrap, imageUpload.status === "failed" && styles.pendingImageFailed]}>
            <Image source={{ uri: imageUpload.localUri }} style={styles.pendingImage} />
            <Pressable onPress={removeImage} style={styles.removeImageButton}>
              <Ionicons name="close" size={15} color={colors.card} />
            </Pressable>
            {imageUpload.status === "uploading" ? (
              <View style={styles.uploadProgressTrack}>
                <View style={[styles.uploadProgressFill, { width: `${Math.round((imageUpload.progress ?? 0.18) * 100)}%` as `${number}%` }]} />
              </View>
            ) : null}
            <View style={styles.pendingImageLabelRow}>
              <Text style={styles.pendingImageText}>
                {imageUpload.status === "uploading"
                  ? imageUpload.progress === null ? "上传中..." : `上传 ${Math.round(imageUpload.progress * 100)}%`
                  : imageUpload.status === "failed" ? "上传失败" : "待发送图片"}
              </Text>
              {imageUpload.status === "failed" ? (
                <Pressable onPress={() => void doUploadImage(imageUpload.localUri)} style={styles.retryButton}>
                  <Text style={styles.retryText}>重试</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
        <View style={styles.composerRow}>
        <Pressable style={styles.smallIcon} onPress={() => setShowStickers((value) => !value)}>
          <Ionicons name="happy-outline" size={21} color={colors.mutedText} />
        </Pressable>
        <Pressable style={[styles.smallIcon, imageUpload.status === "uploading" && styles.disabledIcon]} onPress={imageUpload.status === "uploading" ? undefined : pickImage}>
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
  pendingImageWrap: {
    alignSelf: "flex-start",
    width: 132,
    height: 104,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.nightCard,
    borderWidth: 1,
    borderColor: "#3B2E4D"
  },
  pendingImageFailed: {
    borderColor: colors.danger
  },
  pendingImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover"
  },
  removeImageButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center"
  },
  uploadProgressTrack: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden"
  },
  uploadProgressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary
  },
  pendingImageLabelRow: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  pendingImageText: {
    flex: 1,
    color: colors.card,
    fontSize: 11,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 3
  },
  retryButton: {
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  retryText: {
    color: colors.card,
    fontSize: 10,
    fontWeight: "900"
  },
  smallIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.nightCard
  },
  disabledIcon: {
    opacity: 0.45
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
