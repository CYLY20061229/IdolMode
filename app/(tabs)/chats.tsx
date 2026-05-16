import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import ChatListItem from "@/components/ChatListItem";
import IconButton from "@/components/IconButton";
import { colors, spacing } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { useIdolMode } from "@/context/IdolModeContext";

export default function ChatsScreen() {
  const theme = useAppTheme();
  const { myProfile, addedArtists, removeArtist, idolThreads } = useIdolMode();
  const [deleteMode, setDeleteMode] = useState(false);

  const lastForArtist = (artistId: string) => {
    const thread = idolThreads.find((item) => item.artistId === artistId);
    const messages = thread?.messages ?? [];
    return messages.length ? messages[messages.length - 1].text : "还没有消息。";
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>聊天</Text>
        <View style={styles.actions}>
          <IconButton name="search-outline" accessibilityLabel="搜索聊天" />
          <IconButton
            name={deleteMode ? "checkmark-outline" : "trash-outline"}
            color={deleteMode ? theme.colors.primaryDeep : theme.colors.text}
            accessibilityLabel="管理好友"
            onPress={() => setDeleteMode((value) => !value)}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ChatListItem
          avatar={myProfile.avatar}
          name={myProfile.nickname}
          lastMessage="你的艺人聊天室 · 发送营业消息"
          onPress={() => router.push("/self-chat")}
          backgroundColor={colors.secondary}
        />

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>好友</Text>
        <View style={styles.list}>
          {addedArtists.map((artist) => (
            <ChatListItem
              key={artist.id}
              avatar={artist.avatar}
              name={artist.nickname}
              lastMessage={lastForArtist(artist.id)}
              onPress={() => router.push(`/idol-chat/${artist.id}`)}
              showDelete={deleteMode}
              onDelete={() => removeArtist(artist.id)}
              backgroundColor={artist.background}
            />
          ))}
          {addedArtists.length === 0 ? <Text style={[styles.empty, { color: theme.colors.mutedText }]}>还没有好友，去「好友」页添加艺人吧。</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 58,
    paddingHorizontal: spacing.screen
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  actions: {
    flexDirection: "row",
    gap: 8
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900"
  },
  content: {
    paddingTop: 22,
    paddingBottom: 116,
    gap: 16
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 6
  },
  list: {
    gap: 12
  },
  empty: {
    color: colors.mutedText,
    textAlign: "center",
    marginTop: 18
  }
});
