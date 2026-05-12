import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Avatar } from "@/components/Avatar";
import ArtistCard from "@/components/ArtistCard";
import IconButton from "@/components/IconButton";
import PrimaryButton from "@/components/PrimaryButton";
import ProfileCard from "@/components/ProfileCard";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";
import { pickLocalImage } from "@/services/localMedia";

export default function FriendsScreen() {
  const { myProfile, updateProfile, recommendedArtists } = useIdolMode();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(myProfile.nickname);
  const [signature, setSignature] = useState(myProfile.signature);
  const [avatar, setAvatar] = useState(myProfile.avatar);

  const saveProfile = () => {
    const isImageAvatar = /^(file|content|data|https?):/.test(avatar);
    updateProfile({ ...myProfile, nickname, signature, avatar: isImageAvatar ? avatar : avatar.slice(0, 3).toUpperCase() || "我" });
    setEditing(false);
  };

  const pickAvatar = async () => {
    const uri = await pickLocalImage();
    if (uri) setAvatar(uri);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>好友</Text>
        <IconButton name="search-outline" accessibilityLabel="搜索好友" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>我的资料</Text>
        <ProfileCard profile={myProfile} onPress={() => router.push("/my-profile")} />

        <Text style={styles.sectionTitle}>推荐艺人</Text>
        <View style={styles.list}>
          {recommendedArtists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} onPress={() => router.push(`/artist/${artist.id}`)} />
          ))}
        </View>
      </ScrollView>

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>编辑资料</Text>
            <View style={styles.avatarEditRow}>
              <Avatar label={avatar} size={72} />
              <View style={styles.avatarEditText}>
                <Text style={styles.avatarLabel}>头像</Text>
                <Text style={styles.avatarHint}>可以使用本地图片，第一版会保存在当前设备。</Text>
              </View>
            </View>
            <PrimaryButton title="选择本地头像" onPress={pickAvatar} variant="light" />
            <PrimaryButton title="保存" onPress={saveProfile} />
            <PrimaryButton title="取消" onPress={() => setEditing(false)} variant="light" />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 58,
    paddingHorizontal: spacing.screen
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900"
  },
  content: {
    paddingTop: 22,
    paddingBottom: 116,
    gap: 14
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 8
  },
  list: {
    gap: 12
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(47,42,53,0.28)",
    justifyContent: "center",
    padding: 22
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 20,
    gap: 12
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900"
  },
  avatarEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  avatarEditText: {
    flex: 1,
    gap: 4
  },
  avatarLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  avatarHint: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17
  }
});
