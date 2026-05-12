import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Avatar } from "@/components/Avatar";
import ChatBubble from "@/components/ChatBubble";
import IconButton from "@/components/IconButton";
import StickerTray from "@/components/StickerTray";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";
import { pickLocalImage } from "@/services/localMedia";

export default function IdolChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { idolThreads, sendIdolChatMessage, recommendedArtists, stickerUris, addSticker } = useIdolMode();
  const [text, setText] = useState("");
  const [showStickers, setShowStickers] = useState(false);
  const artist = recommendedArtists.find((item) => item.id === id) ?? recommendedArtists[0];
  const thread = idolThreads.find((item) => item.artistId === artist.id);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendIdolChatMessage(artist.id, trimmed);
    setText("");
  };

  const sendBackground = async () => {
    const uri = await pickLocalImage();
    if (!uri) return;
    sendIdolChatMessage(artist.id, text.trim() || "发送了一张背景图", {
      attachmentType: "background",
      attachmentUri: uri
    });
    setText("");
  };

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
        <IconButton name="chevron-back" accessibilityLabel="返回" onPress={() => router.back()} />
        <View style={styles.artist}>
          <Avatar label={artist.avatar} size={38} backgroundColor={artist.background} />
          <Text style={styles.name}>{artist.nickname}</Text>
        </View>
        <View style={styles.spacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.messages}>
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
  smallIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
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
