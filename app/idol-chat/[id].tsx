import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Avatar } from "@/components/Avatar";
import ChatBubble from "@/components/ChatBubble";
import IconButton from "@/components/IconButton";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";
import { recommendedArtists } from "@/services/mockData";

export default function IdolChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { idolThreads, sendIdolChatMessage } = useIdolMode();
  const [text, setText] = useState("");
  const artist = recommendedArtists.find((item) => item.id === id) ?? recommendedArtists[0];
  const thread = idolThreads.find((item) => item.artistId === artist.id);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendIdolChatMessage(artist.id, trimmed);
    setText("");
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => router.back()} />
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
          />
        ))}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={`Message ${artist.nickname}...`}
          placeholderTextColor={colors.mutedText}
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
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 14,
    paddingBottom: 30,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border
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
