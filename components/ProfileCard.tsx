import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { colors, shadow } from "@/constants/theme";
import { Profile } from "@/types/idol";

type ProfileCardProps = {
  profile: Profile;
  onPress?: () => void;
};

export default function ProfileCard({ profile, onPress }: ProfileCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Avatar label={profile.avatar} size={62} />
      <View style={styles.textWrap}>
        <Text style={styles.name}>{profile.nickname}</Text>
        <Text numberOfLines={2} style={styles.signature}>{profile.signature}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadow,
    backgroundColor: colors.card,
    borderRadius: 28,
    flexDirection: "row",
    gap: 14,
    padding: 16,
    alignItems: "center"
  },
  pressed: {
    opacity: 0.78
  },
  textWrap: {
    flex: 1,
    gap: 5
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  signature: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18
  }
});
