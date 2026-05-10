import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { colors } from "@/constants/theme";

type ChatListItemProps = {
  avatar: string;
  name: string;
  lastMessage: string;
  onPress: () => void;
  onDelete?: () => void;
  showDelete?: boolean;
  backgroundColor?: string;
};

export default function ChatListItem({
  avatar,
  name,
  lastMessage,
  onPress,
  onDelete,
  showDelete,
  backgroundColor
}: ChatListItemProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Avatar label={avatar} size={54} backgroundColor={backgroundColor} />
      <View style={styles.textWrap}>
        <Text style={styles.name}>{name}</Text>
        <Text numberOfLines={1} style={styles.last}>{lastMessage}</Text>
      </View>
      {showDelete ? (
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <Ionicons name="remove" size={18} color={colors.card} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={19} color={colors.mutedText} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  pressed: {
    opacity: 0.74
  },
  textWrap: {
    flex: 1,
    gap: 4
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  last: {
    color: colors.mutedText,
    fontSize: 13
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center"
  }
});
