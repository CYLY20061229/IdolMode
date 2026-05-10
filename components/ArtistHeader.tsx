import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { colors } from "@/constants/theme";
import { Artist } from "@/types/idol";

type ArtistHeaderProps = {
  artist: Artist;
};

export default function ArtistHeader({ artist }: ArtistHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.background, { backgroundColor: artist.background }]}>
        <View style={styles.moon} />
      </View>
      <View style={styles.profile}>
        <Avatar label={artist.avatar} size={86} backgroundColor={colors.card} />
        <Text style={styles.name}>{artist.nickname}</Text>
        <Text style={styles.signature}>{artist.signature}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.pill}>{artist.identity}</Text>
          <Text style={styles.fans}>{artist.fans} fans</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -20
  },
  background: {
    height: 190,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    overflow: "hidden"
  },
  moon: {
    position: "absolute",
    right: 42,
    top: 36,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.5)"
  },
  profile: {
    alignItems: "center",
    marginTop: -46,
    paddingHorizontal: 20,
    gap: 8
  },
  name: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900"
  },
  signature: {
    color: colors.mutedText,
    fontSize: 14,
    textAlign: "center"
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4
  },
  pill: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.secondary,
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  fans: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: "800"
  }
});
