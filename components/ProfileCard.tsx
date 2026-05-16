import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { shadow } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Profile } from "@/types/idol";

type ProfileCardProps = {
  profile: Profile;
  onPress?: () => void;
};

export default function ProfileCard({ profile, onPress }: ProfileCardProps) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.card,
      { backgroundColor: theme.colors.card },
      pressed && styles.pressed
    ]}>
      <Avatar label={profile.avatar} size={62} />
      <View style={styles.textWrap}>
        <Text style={[styles.name, { color: theme.colors.text }]}>{profile.nickname}</Text>
        <Text numberOfLines={2} style={[styles.signature, { color: theme.colors.mutedText }]}>{profile.signature}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadow,
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
    fontSize: 18,
    fontWeight: "800"
  },
  signature: {
    fontSize: 13,
    lineHeight: 18
  }
});
