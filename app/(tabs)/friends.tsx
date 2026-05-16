import { useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Avatar } from "@/components/Avatar";
import ArtistCard from "@/components/ArtistCard";
import IconButton from "@/components/IconButton";
import PrimaryButton from "@/components/PrimaryButton";
import ProfileCard from "@/components/ProfileCard";
import { colors, spacing } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { useIdolMode } from "@/context/IdolModeContext";
import { pickProfileAvatarImage } from "@/services/localMedia";
import { uploadImageToOss } from "@/services/uploadApi";

export default function FriendsScreen() {
  const theme = useAppTheme();
  const { myProfile, updateProfile, recommendedArtists } = useIdolMode();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(myProfile.nickname);
  const [signature, setSignature] = useState(myProfile.signature);
  const [avatar, setAvatar] = useState(myProfile.avatar);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const saveProfile = async () => {
    if (uploadingAvatar) {
      Alert.alert("头像上传中", "请等头像上传完成后再保存。");
      return;
    }
    const isImageAvatar = /^(https?):/.test(avatar);
    try {
      await updateProfile({ ...myProfile, nickname, signature, avatar: isImageAvatar ? avatar : avatar.slice(0, 3).toUpperCase() || "我" });
      setEditing(false);
    } catch (error) {
      Alert.alert("保存失败", error instanceof Error ? error.message : "资料没有保存成功，请稍后再试。");
    }
  };

  const pickAvatar = async () => {
    const uri = await pickProfileAvatarImage();
    if (!uri || uploadingAvatar) return;
    setAvatar(uri);
    setUploadingAvatar(true);
    try {
      const publicUrl = await uploadImageToOss(uri, "avatar");
      setAvatar(publicUrl);
    } catch {
      Alert.alert("上传失败", "头像没有上传成功，请重新选择。");
      setAvatar(myProfile.avatar);
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>好友</Text>
        <IconButton name="search-outline" accessibilityLabel="搜索好友" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>我的资料</Text>
        <ProfileCard profile={myProfile} onPress={() => router.push("/my-profile")} />

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>推荐艺人</Text>
        <View style={styles.list}>
          {recommendedArtists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} onPress={() => router.push(`/artist/${artist.id}`)} />
          ))}
        </View>
      </ScrollView>

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>编辑资料</Text>
            <View style={styles.avatarEditRow}>
              <Avatar label={avatar} size={72} />
              <View style={styles.avatarEditText}>
                <Text style={[styles.avatarLabel, { color: theme.colors.text }]}>头像</Text>
                <Text style={[styles.avatarHint, { color: theme.colors.mutedText }]}>头像会上传到云端，并在不同设备保持一致。</Text>
              </View>
            </View>
            <PrimaryButton title={uploadingAvatar ? "头像上传中…" : "选择头像"} onPress={pickAvatar} variant="light" />
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
    paddingTop: 58,
    paddingHorizontal: spacing.screen
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    fontSize: 34,
    fontWeight: "900"
  },
  content: {
    paddingTop: 22,
    paddingBottom: 116,
    gap: 14
  },
  sectionTitle: {
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
    borderRadius: 28,
    padding: 20,
    gap: 12
  },
  modalTitle: {
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
    fontSize: 15,
    fontWeight: "900"
  },
  avatarHint: {
    fontSize: 12,
    lineHeight: 17
  }
});
