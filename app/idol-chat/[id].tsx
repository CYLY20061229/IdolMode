import { useCallback, useRef, useState } from "react";
import { Alert, Image, InteractionManager, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { Avatar } from "@/components/Avatar";
import ChatBubble from "@/components/ChatBubble";
import IconButton from "@/components/IconButton";
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

export default function IdolChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { idolThreads, sendIdolChatMessage, receiveArtistBubbleMessage, recommendedArtists, stickerUris, addSticker } = useIdolMode();
  const [text, setText] = useState("");
  const [showStickers, setShowStickers] = useState(false);
  const [imageUpload, setImageUpload] = useState<ImageUploadState>({ status: "idle" });
  const uploadRunId = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const autoScrollUntil = useRef(0);
  const artist = recommendedArtists.find((item) => item.id === id) ?? recommendedArtists[0];
  const thread = idolThreads.find((item) => item.artistId === artist.id);
  const threadMessageCount = thread?.messages.length ?? 0;

  const scrollToLatest = useCallback((animated = false) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated });
    }, 120);
  }, []);

  useFocusEffect(
    useCallback(() => {
      autoScrollUntil.current = Date.now() + 1800;
      const task = InteractionManager.runAfterInteractions(() => {
        scrollToLatest(false);
      });
      const timers = [80, 260, 650, 1200].map((delay) =>
        setTimeout(() => scrollToLatest(false), delay)
      );

      return () => {
        autoScrollUntil.current = 0;
        task.cancel();
        timers.forEach(clearTimeout);
      };
    }, [artist.id, scrollToLatest])
  );

  useFocusEffect(
    useCallback(() => {
      const initialTimer = setTimeout(() => {
        if (threadMessageCount === 0) {
          receiveArtistBubbleMessage(artist.id);
        }
      }, 450);
      const interval = setInterval(() => {
        if (Math.random() < 0.42) {
          receiveArtistBubbleMessage(artist.id);
        }
      }, 26000);

      return () => {
        clearTimeout(initialTimer);
        clearInterval(interval);
      };
    }, [artist.id, receiveArtistBubbleMessage, threadMessageCount])
  );

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
    sendIdolChatMessage(artist.id, trimmed || "", attachment);
    setText("");
    setImageUpload({ status: "idle" });
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
    sendIdolChatMessage(artist.id, "发送了一个表情包", {
      attachmentType: "sticker",
      attachmentUri: uri
    });
    setShowStickers(false);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="返回" onPress={() => router.replace("/chats")} />
        <View style={styles.artist}>
          <Avatar label={artist.avatar} size={38} backgroundColor={artist.background} />
          <Text style={styles.name}>{artist.nickname}</Text>
        </View>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => {
          if (Date.now() <= autoScrollUntil.current) {
            scrollToLatest(false);
          }
        }}
      >
        {(thread?.messages ?? []).map((message) => (
          <ChatBubble
            key={message.id}
            text={message.text}
            side={message.sender === "user" ? "right" : "left"}
            time={message.createdAt}
            attachmentType={message.attachmentType}
            attachmentUri={message.attachmentUri}
            quotedFanMessage={message.quotedFanMessage}
          />
        ))}
      </ScrollView>

      <View style={styles.composer}>
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
          placeholder={`给 ${artist.nickname} 发消息...`}
          placeholderTextColor={colors.mutedText}
          style={styles.input}
          multiline
        />
        <Pressable onPress={send} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
          <Ionicons name="send" size={18} color={colors.card} />
        </Pressable>
        </View>
        {showStickers ? (
          <StickerTray stickerUris={stickerUris} onAddSticker={addSticker} onSendSticker={sendSticker} />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FBF7FF",
    paddingTop: 54
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screen,
    paddingBottom: 12
  },
  artist: {
    alignItems: "center",
    gap: 5
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  spacer: {
    width: 38
  },
  messages: {
    paddingHorizontal: spacing.screen,
    paddingTop: 14,
    paddingBottom: 104
  },
  composer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
    padding: 14,
    paddingBottom: 30,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10
  },
  pendingImageWrap: {
    alignSelf: "flex-start",
    width: 132,
    height: 104,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  },
  disabledIcon: {
    opacity: 0.45
  },
  input: {
    flex: 1,
    maxHeight: 92,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 11,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.75
  }
});
