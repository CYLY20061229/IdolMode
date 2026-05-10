import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import ArtistCard from "@/components/ArtistCard";
import IconButton from "@/components/IconButton";
import PrimaryButton from "@/components/PrimaryButton";
import ProfileCard from "@/components/ProfileCard";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";
import { recommendedArtists } from "@/services/mockData";

export default function FriendsScreen() {
  const { myProfile, updateProfile } = useIdolMode();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(myProfile.nickname);
  const [signature, setSignature] = useState(myProfile.signature);
  const [avatar, setAvatar] = useState(myProfile.avatar);

  const saveProfile = () => {
    updateProfile({ ...myProfile, nickname, signature, avatar: avatar.slice(0, 3).toUpperCase() || "ME" });
    setEditing(false);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <IconButton name="search-outline" accessibilityLabel="Search friends" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>My Profile</Text>
        <ProfileCard profile={myProfile} onPress={() => setEditing(true)} />

        <Text style={styles.sectionTitle}>Recommended Artists</Text>
        <View style={styles.list}>
          {recommendedArtists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} onPress={() => router.push(`/artist/${artist.id}`)} />
          ))}
        </View>
      </ScrollView>

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TextInput value={nickname} onChangeText={setNickname} placeholder="Nickname" style={styles.input} />
            <TextInput value={signature} onChangeText={setSignature} placeholder="Signature" style={[styles.input, styles.tallInput]} multiline />
            <TextInput value={avatar} onChangeText={setAvatar} placeholder="Avatar initials" style={styles.input} maxLength={3} />
            <PrimaryButton title="Save" onPress={saveProfile} />
            <PrimaryButton title="Cancel" onPress={() => setEditing(false)} variant="light" />
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
  input: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: colors.background
  },
  tallInput: {
    minHeight: 86,
    paddingTop: 13
  }
});
