import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { pickLocalImage } from "@/services/localMedia";

type StickerTrayProps = {
  stickerUris: string[];
  onAddSticker: (uri: string) => void;
  onSendSticker: (uri: string) => void;
  dark?: boolean;
};

export default function StickerTray({ stickerUris, onAddSticker, onSendSticker, dark }: StickerTrayProps) {
  const add = async () => {
    const uri = await pickLocalImage();
    if (uri) onAddSticker(uri);
  };

  return (
    <View style={[styles.wrap, dark && styles.darkWrap]}>
      <Pressable onPress={add} style={[styles.addButton, dark && styles.darkAddButton]}>
        <Ionicons name="add" size={22} color={dark ? colors.card : colors.primaryDeep} />
        <Text style={[styles.addText, dark && styles.darkText]}>添加表情包</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {stickerUris.map((uri) => (
          <Pressable key={uri} onPress={() => onSendSticker(uri)} style={styles.stickerButton}>
            <Image source={{ uri }} style={styles.sticker} />
          </Pressable>
        ))}
        {stickerUris.length === 0 ? <Text style={[styles.empty, dark && styles.darkText]}>还没有自定义表情包</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    gap: 10
  },
  darkWrap: {
    borderTopColor: "#302640"
  },
  addButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.background
  },
  darkAddButton: {
    backgroundColor: colors.nightCard
  },
  addText: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: "900"
  },
  darkText: {
    color: colors.card
  },
  list: {
    alignItems: "center",
    gap: 10,
    paddingBottom: 2
  },
  stickerButton: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  sticker: {
    width: 52,
    height: 52,
    resizeMode: "contain"
  },
  empty: {
    color: colors.mutedText,
    fontSize: 12,
    paddingVertical: 12
  }
});
