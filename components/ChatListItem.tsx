import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";

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
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.row,
      { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
      pressed && styles.pressed
    ]}>
      <Avatar label={avatar} size={54} backgroundColor={backgroundColor} />
      <View style={styles.textWrap}>
        <Text style={[styles.name, { color: theme.colors.text }]}>{name}</Text>
        <Text numberOfLines={1} style={[styles.last, { color: theme.colors.mutedText }]}>{lastMessage}</Text>
      </View>
      {showDelete ? (
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <Ionicons name="remove" size={18} color={colors.card} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={19} color={theme.colors.mutedText} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 14,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.74
  },
  textWrap: {
    flex: 1,
    gap: 4
  },
  name: {
    fontSize: 16,
    fontWeight: "800"
  },
  last: {
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
