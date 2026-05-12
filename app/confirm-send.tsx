import { useEffect, useRef, useState } from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Audio } from "expo-av";
import ChatBubble from "@/components/ChatBubble";
import IconButton from "@/components/IconButton";
import PrimaryButton from "@/components/PrimaryButton";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";

// 预加载音效，避免首次播放延迟
const SEND_SOUND = require("../assets/sounds/send.wav");

export default function ConfirmSendScreen() {
  const { messageId } = useLocalSearchParams<{ messageId: string }>();
  const { selfMessages, confirmSelfMessage, myProfile } = useIdolMode();
  const [sending, setSending] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const message = selfMessages.find((item) => item.id === messageId);
  const alreadySent = message?.status === "sent";

  // 挂载时预加载音效
  useEffect(() => {
    let mounted = true;
    Audio.Sound.createAsync(SEND_SOUND, { shouldPlay: false })
      .then(({ sound }) => {
        if (mounted) soundRef.current = sound;
      })
      .catch(() => {
        // 音效加载失败不影响主流程
      });
    return () => {
      mounted = false;
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const playSendSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      }
    } catch {
      // 静默失败，不影响发送流程
    }
  };

  const doConfirmSend = async () => {
    if (!message || alreadySent || sending) return;
    setSending(true);
    try {
      // 先播音效，再等待发送完成，两者并发
      void playSendSound();
      await confirmSelfMessage(message.id);
      router.replace("/self-chat");
    } catch (error) {
      console.warn("Confirm send failed.", error);
      Alert.alert("发送失败", "请稍后再试。");
    } finally {
      setSending(false);
    }
  };

  const confirm = () => {
    if (!message || alreadySent) return;
    if (Platform.OS === "web") {
      const ok = globalThis.confirm?.("确定要把这条消息发送给粉丝吗？") ?? true;
      if (ok) {
        void doConfirmSend();
      }
      return;
    }

    Alert.alert("确认发送", "确定要把这条消息发送给粉丝吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确认发送",
        onPress: () => void doConfirmSend()
      }
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="返回" onPress={() => router.back()} />
        <Text style={styles.title}>预览</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.previewCard}>
        <Text style={styles.eyebrow}>粉丝视角</Text>
        {/* 模拟聊天界面：深色背景 + 消息气泡 */}
        <View style={styles.chatMock}>
          <Text style={styles.chatName}>{myProfile.nickname}</Text>
          <ChatBubble
            text={message?.text ?? "消息不存在。"}
            side="left"
            time={message?.createdAt}
            attachmentType={message?.attachmentType}
            attachmentUri={message?.attachmentUri}
            quotedFanMessage={message?.quotedFanMessage}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          title={sending ? "发送中..." : alreadySent ? "已发送" : "确认发送"}
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
    backgroundColor: colors.card,
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
    width: 0
  },
  previewCard: {
    marginTop: 44,
    backgroundColor: colors.card,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 12,
    overflow: "hidden"
  },
  eyebrow: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  chatMock: {
    backgroundColor: colors.night,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 2
  },
  chatName: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
    paddingLeft: 4
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
