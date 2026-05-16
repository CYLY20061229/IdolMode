import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/context/AppThemeContext";

type SettingsRowProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  hideChevron?: boolean;
};

export default function SettingsRow({ title, icon, value, onPress, danger, hideChevron }: SettingsRowProps) {
  const theme = useAppTheme();
  const titleColor = danger ? theme.colors.danger : theme.colors.text;
  const iconColor = danger ? theme.colors.danger : theme.colors.primaryDeep;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        pressed && styles.pressed
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.iconWrap, { backgroundColor: danger ? `${theme.colors.danger}18` : theme.colors.background }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      {value ? (
        <Text style={[styles.value, { color: theme.colors.mutedText }]}>{value}</Text>
      ) : null}
      {!hideChevron && (
        <Ionicons name="chevron-forward" size={18} color={danger ? theme.colors.danger : theme.colors.mutedText} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  pressed: {
    opacity: 0.65
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800"
  },
  value: {
    fontSize: 14,
    fontWeight: "600"
  }
});
