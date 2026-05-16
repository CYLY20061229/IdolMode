import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Alert, Image, InteractionManager, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import ChatBubble from "@/components/ChatBubble";
import FanEmojiBubble from "@/components/FanEmojiBubble";
import FanMessageTicker from "@/components/FanMessageTicker";
import IconButton from "@/components/IconButton";
import PollCard from "@/components/PollCard";
import QuoteComposerPreview from "@/components/QuoteComposerPreview";
import StickerTray from "@/components/StickerTray";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";
import { generateImageCaption } from "@/services/fanMessageApi";
import { pickImageForChat } from "@/services/localMedia";
import { uploadImageToOss } from "@/services/uploadApi";

type ImageUploadState =
  | { status: "idle" }
  | { status: "uploading"; localUri: string; progress: number | null }
  | { status: "failed"; localUri: string; message: string }
  | { status: "uploaded"; localUri: string; remoteUri: string; imageCaption?: string };

function uploadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "网络不稳定，图片还没有发送。";
}

export default function SelfChatScreen() {
  const {
    myProfile,
    selfMessages,
    sendSelfDraft,
    sendPoll,
    fanMessages,
    quotedFanMessage,
    clearQuotedFanMessage,
    stickerUris,
    addSticker,
    growthStats,
    hiddenMessageIds,
    hideMessage
  } = useIdolMode();
  const [text, setText] = useState("");
  const fanName = myProfile.fanName;
  const [showStickers, setShowStickers] = useState(false);
  const [imageUpload, setImageUpload] = useState<ImageUploadState>({ status: "idle" });
  const [composerMode, setComposerMode] = useState<"text" | "voice">("text");
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollDuration, setPollDuration] = useState(30);
  const [pollCustomDuration, setPollCustomDuration] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showFanNameHint, setShowFanNameHint] = useState(false);
  const recordingStartedAt = useRef(0);
  const textInputRef = useRef<TextInput>(null);
  const uploadRunId = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const autoScrollUntil = useRef(0);
  const visibleMessages = selfMessages.filter(
    (message) => message.sender === "self" && !hiddenMessageIds.includes(message.id)
  );

  const scrollToLatest = useCallback((animated = false) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated });
    }, 120);
  }, []);

  const cleanFanName = typeof fanName === "string" ? fanName.trim().replace(/^@+/, "") : "";

  const handleTextChange = (value: string) => {
    setText(value);
    setShowFanNameHint(Boolean(cleanFanName && value.endsWith("@")));
  };

  const insertFanNameMention = () => {
    if (!cleanFanName) return;
    setText((current) => {
      const atIndex = current.lastIndexOf("@");
      if (atIndex < 0) return current;
      return `${current.slice(0, atIndex)}@${cleanFanName} `;
    });
    setShowFanNameHint(false);
    requestAnimationFrame(() => textInputRef.current?.focus());
  };

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
    }, [scrollToLatest])
  );

  useEffect(() => {
    return () => {
      recording?.stopAndUnloadAsync().catch(() => {});
    };
  }, [recording]);

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
      ? { attachmentType: "background" as const, attachmentUri: imageUpload.remoteUri, imageCaption: imageUpload.imageCaption }
      : undefined;
    const message = sendSelfDraft(trimmed || "发送了一张图片", attachment);
    setText("");
    setShowFanNameHint(false);
    setImageUpload({ status: "idle" });
    router.push({ pathname: "/confirm-send", params: { messageId: message.id } });
  };

  const handleDeleteMessage = (messageId: string) => {
    setDeleteTargetId(messageId);
    Alert.alert("删除消息", "确定要删除这条消息吗？", [
      { text: "取消", style: "cancel", onPress: () => setDeleteTargetId(null) },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          hideMessage(messageId);
          setDeleteTargetId(null);
        }
      }
    ]);
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
      const imageCaption = await generateImageCaption(remoteUrl);
      if (runId !== uploadRunId.current) return;
      setImageUpload({ status: "uploaded", localUri, remoteUri: remoteUrl, imageCaption });
    } catch (error) {
      if (runId !== uploadRunId.current) return;
      setImageUpload({ status: "failed", localUri, message: uploadErrorMessage(error) });
    }
  };

  const pickImage = async () => {
    const uri = await pickImageForChat();
    if (!uri) return;
    setShowStickers(false);
    setShowPlusMenu(false);
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

  const startVoiceRecording = async () => {
    if (recording) return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("无法录音", "请在系统设置中允许麦克风权限。");
        return;
      }
      setShowStickers(false);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false
      });
      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await nextRecording.startAsync();
      recordingStartedAt.current = Date.now();
      setRecording(nextRecording);
    } catch (error) {
      console.warn("Voice recording failed to start.", error);
      Alert.alert("录音失败", "请稍后再试。");
    }
  };

  const finishVoiceRecording = async () => {
    if (!recording) return;
    const activeRecording = recording;
    setRecording(null);
    try {
      await activeRecording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = activeRecording.getURI();
      const status = await activeRecording.getStatusAsync();
      const durationMs = status.isDoneRecording ? status.durationMillis ?? Date.now() - recordingStartedAt.current : Date.now() - recordingStartedAt.current;
      if (!uri) {
        Alert.alert("录音失败", "没有拿到语音文件，请重试。");
        return;
      }
      if (durationMs < 500) {
        Alert.alert("录音太短", "请按住说话至少半秒。");
        return;
      }
      const message = sendSelfDraft("语音消息", {
        attachmentType: "voice",
        attachmentUri: uri,
        audioDurationMs: durationMs
      });
      router.push({ pathname: "/confirm-send", params: { messageId: message.id } });
    } catch (error) {
      console.warn("Voice recording failed to finish.", error);
      Alert.alert("录音失败", "请重新录制。");
    }
  };

  const cancelVoiceMode = () => {
    if (recording) void finishVoiceRecording();
    setComposerMode("text");
  };

  const openPollModal = () => {
    setShowPlusMenu(false);
    setShowStickers(false);
    setShowPollModal(true);
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  const addPollOption = () => {
    setPollOptions((current) => current.length >= 4 ? current : [...current, ""]);
  };

  const submitPoll = () => {
    const cleanOptions = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (!pollQuestion.trim() || cleanOptions.length < 2) {
      Alert.alert("投票还没填完", "请输入问题，并至少填写 2 个选项。");
      return;
    }
    const customDuration = Number(pollCustomDuration.trim());
    const durationMinutes = Number.isFinite(customDuration) && customDuration > 0
      ? Math.min(Math.floor(customDuration), 1440)
      : pollDuration;
    const message = sendPoll({
      question: pollQuestion.trim(),
      options: cleanOptions,
      durationMinutes
    });
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollDuration(30);
    setPollCustomDuration("");
    setShowPollModal(false);
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
        {visibleMessages.map((message) => (
          <Fragment key={message.id}>
            {message.type === "poll" && message.poll ? (
              <Pressable
                disabled={message.status !== "pending"}
                onPress={() => router.push({ pathname: "/confirm-send", params: { messageId: message.id } })}
              >
                <PollCard poll={message.poll} dark />
              </Pressable>
            ) : (
              <ChatBubble
                text={message.text}
                side="right"
                time={message.createdAt}
                status={message.status === "pending" ? "未确认发送" : undefined}
                dark
                attachmentType={message.attachmentType}
                attachmentUri={message.attachmentUri}
                audioDurationMs={message.audioDurationMs}
                recognizedText={message.recognizedText}
                quotedFanMessage={message.quotedFanMessage}
                onArrowPress={() => router.push({ pathname: "/confirm-send", params: { messageId: message.id } })}
                onLongPress={() => handleDeleteMessage(message.id)}
              />
            )}
            {message.status === "sent" ? (
              <FanEmojiBubble
                seed={message.id}
                onPress={() => router.push("/fan-messages")}
              />
            ) : null}
          </Fragment>
        ))}
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
        {showFanNameHint && cleanFanName ? (
          <Pressable style={styles.fanNameHint} onPress={insertFanNameMention}>
            <Text style={styles.fanNameHintText}>@{cleanFanName}</Text>
          </Pressable>
        ) : null}
        {composerMode === "voice" ? (
          <View style={styles.voiceComposerRow}>
            <Pressable style={styles.smallIcon} onPress={cancelVoiceMode}>
              <Ionicons name="keypad-outline" size={21} color={colors.mutedText} />
            </Pressable>
            <Pressable
              style={[styles.voiceHoldButton, recording && styles.voiceHoldButtonActive]}
              onPressIn={() => void startVoiceRecording()}
              onPressOut={() => void finishVoiceRecording()}
            >
              <Ionicons name={recording ? "radio-button-on" : "mic-outline"} size={19} color={recording ? colors.card : colors.primaryDeep} />
              <Text style={[styles.voiceHoldText, recording && styles.voiceHoldTextActive]}>{recording ? "松开发送" : "按住说话"}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.composerRow}>
            <Pressable style={styles.smallIcon} onPress={() => setComposerMode("voice")}>
              <Ionicons name="mic-outline" size={21} color={colors.mutedText} />
            </Pressable>
            <TextInput
              ref={textInputRef}
              value={text}
              onChangeText={handleTextChange}
              placeholder="写一条营业..."
              placeholderTextColor="#A99CB6"
              style={styles.input}
              multiline
            />
            <Pressable onPress={send} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
              <Ionicons name="send" size={18} color={colors.card} />
            </Pressable>
            <Pressable style={styles.smallIcon} onPress={() => {
              setShowStickers((value) => !value);
              setShowPlusMenu(false);
            }}>
              <Ionicons name="happy-outline" size={21} color={colors.mutedText} />
            </Pressable>
            <Pressable style={styles.smallIcon} onPress={() => {
              setShowPlusMenu((value) => !value);
              setShowStickers(false);
            }}>
              <Ionicons name="add" size={23} color={colors.mutedText} />
            </Pressable>
          </View>
        )}
        {showPlusMenu ? (
          <View style={styles.plusMenu}>
            <Pressable style={styles.plusItem} onPress={pickImage}>
              <Ionicons name="image-outline" size={20} color={colors.primary} />
              <Text style={styles.plusItemText}>图片</Text>
            </Pressable>
            <Pressable style={styles.plusItem} onPress={openPollModal}>
              <Ionicons name="stats-chart-outline" size={20} color={colors.primary} />
              <Text style={styles.plusItemText}>投票</Text>
            </Pressable>
          </View>
        ) : null}
        {showStickers ? (
          <StickerTray stickerUris={stickerUris} onAddSticker={addSticker} onSendSticker={sendSticker} dark />
        ) : null}
      </View>

      <Modal visible={showPollModal} transparent animationType="fade" onRequestClose={() => setShowPollModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.pollModal}>
            <Text style={styles.pollModalTitle}>发起投票</Text>
            <TextInput
              value={pollQuestion}
              onChangeText={setPollQuestion}
              placeholder="想问粉丝什么？"
              placeholderTextColor="#9F93AD"
              style={styles.pollInput}
            />
            {pollOptions.map((option, index) => (
              <TextInput
                key={index}
                value={option}
                onChangeText={(value) => updatePollOption(index, value)}
                placeholder={`选项 ${index + 1}`}
                placeholderTextColor="#9F93AD"
                style={styles.pollInput}
              />
            ))}
            {pollOptions.length < 4 ? (
              <Pressable style={styles.addOptionButton} onPress={addPollOption}>
                <Ionicons name="add" size={16} color={colors.primaryDeep} />
                <Text style={styles.addOptionText}>添加选项</Text>
              </Pressable>
            ) : null}
            <View style={styles.durationRow}>
              {[10, 30, 60, 1440].map((minutes) => (
                <Pressable
                  key={minutes}
                  onPress={() => {
                    setPollDuration(minutes);
                    setPollCustomDuration("");
                  }}
                  style={[styles.durationChip, pollDuration === minutes && !pollCustomDuration && styles.durationChipActive]}
                >
                  <Text style={[styles.durationText, pollDuration === minutes && !pollCustomDuration && styles.durationTextActive]}>
                    {minutes === 1440 ? "24小时" : minutes >= 60 ? "1小时" : `${minutes}分钟`}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={pollCustomDuration}
              onChangeText={(text) => {
                const filtered = text.replace(/[^\d]/g, "");
                setPollCustomDuration(filtered);
                if (filtered) setPollDuration(0);
              }}
              placeholder="自定义分钟数"
              placeholderTextColor="#9F93AD"
              style={[styles.pollInput, styles.customDurationInput]}
              keyboardType="number-pad"
              maxLength={4}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelPollButton} onPress={() => setShowPollModal(false)}>
                <Text style={styles.cancelPollText}>取消</Text>
              </Pressable>
              <Pressable style={styles.sendPollButton} onPress={submitPoll}>
                <Text style={styles.sendPollText}>发送</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  plusMenu: {
    flexDirection: "row",
    gap: 10,
    padding: 10,
    borderRadius: 18,
    backgroundColor: colors.nightCard,
    borderWidth: 1,
    borderColor: "#3B2E4D"
  },
  plusItem: {
    flex: 1,
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: "#20182C",
    alignItems: "center",
    justifyContent: "center",
    gap: 5
  },
  plusItemText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: "800"
  },
  fanNameHint: {
    alignSelf: "flex-start",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.nightCard,
    borderWidth: 1,
    borderColor: "#4C3A62"
  },
  fanNameHintText: {
    color: colors.card,
    fontSize: 13,
    fontWeight: "800"
  },
  voiceComposerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  voiceHoldButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.nightCard,
    borderWidth: 1,
    borderColor: "#3B2E4D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  voiceHoldButtonActive: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.primaryDeep
  },
  voiceHoldText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900"
  },
  voiceHoldTextActive: {
    color: colors.card
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
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 22,
    backgroundColor: "rgba(18,14,26,0.62)"
  },
  pollModal: {
    borderRadius: 26,
    padding: 18,
    gap: 12,
    backgroundColor: colors.card
  },
  pollModalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  pollInput: {
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  addOptionButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  addOptionText: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: "900"
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  durationChip: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  durationChipActive: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.primaryDeep
  },
  durationText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "800"
  },
  durationTextActive: {
    color: colors.card
  },
  customDurationInput: {
    marginTop: 8,
    paddingVertical: 10
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4
  },
  cancelPollButton: {
    flex: 1,
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  },
  cancelPollText: {
    color: colors.mutedText,
    fontSize: 15,
    fontWeight: "900"
  },
  sendPollButton: {
    flex: 1,
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDeep
  },
  sendPollText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: "900"
  }
});
