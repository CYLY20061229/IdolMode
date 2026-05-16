import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { shadow } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Artist } from "@/types/idol";

type ArtistCardProps = {
  artist: Artist;
  onPress: () => void;
};

export default function ArtistCard({ artist, onPress }: ArtistCardProps) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.card,
      { backgroundColor: theme.colors.card },
      pressed && styles.pressed
    ]}>
      <Avatar label={artist.avatar} size={56} backgroundColor={artist.background} />
      <View style={styles.textWrap}>
        <Text style={[styles.name, { color: theme.colors.text }]}>{artist.nickname}</Text>
        <Text numberOfLines={2} style={[styles.bio, { color: theme.colors.mutedText }]}>{artist.bio}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadow,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 15
  },
  pressed: {
    opacity: 0.75
  },
  textWrap: {
    flex: 1,
    gap: 4
  },
  name: {
    fontSize: 17,
    fontWeight: "800"
  },
  bio: {
    fontSize: 13,
    lineHeight: 18
  }
});
