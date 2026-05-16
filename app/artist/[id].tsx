import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import ArtistHeader from "@/components/ArtistHeader";
import IconButton from "@/components/IconButton";
import PrimaryButton from "@/components/PrimaryButton";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addArtist, isArtistAdded, recommendedArtists } = useIdolMode();
  const artist = recommendedArtists.find((item) => item.id === id) ?? recommendedArtists[0];
  const added = isArtistAdded(artist.id);

  return (
    <View style={styles.screen}>
      <View style={styles.back}>
        <IconButton name="chevron-back" accessibilityLabel="返回" onPress={() => router.back()} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ArtistHeader artist={artist} />
        <View style={styles.infoCard}>
          <Text style={styles.label}>关于</Text>
          <Text style={styles.intro}>{artist.intro}</Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton
          title={added ? "已添加" : "添加为好友"}
          disabled={added}
          onPress={() => addArtist(artist)}
          variant={added ? "light" : "primary"}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  back: {
    position: "absolute",
    top: 54,
    left: spacing.screen,
    zIndex: 10
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 124,
    gap: 22
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10
  },
  label: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: "900"
  },
  intro: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingBottom: 34,
    backgroundColor: "rgba(255,249,251,0.96)"
  }
});
