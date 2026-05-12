import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";

type SettingsRowProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  hideChevron?: boolean;
};

export default function SettingsRow({ title, icon, value, onPress, danger, hideChevron }: SettingsRowProps) {
  const titleColor = danger ? colors.danger : colors.text;
  const iconColor = danger ? colors.danger : colors.primaryDeep;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.iconWrap, danger && styles.iconWrapDanger]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      {value ? (
        <Text style={styles.value}>{value}</Text>
      ) : null}
      {!hideChevron && (
        <Ionicons name="chevron-forward" size={18} color={danger ? colors.danger : colors.mutedText} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center"
  },
  iconWrapDanger: {
    backgroundColor: "#FFF0F2"
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800"
  },
  value: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "600"
  }
});
