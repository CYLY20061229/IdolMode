import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import { colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";

type IconButtonProps = {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  backgroundColor?: string;
  size?: number;
  accessibilityLabel: string;
};

export default function IconButton({
  name,
  onPress,
  color = colors.text,
  backgroundColor = colors.card,
  size = 20,
  accessibilityLabel
}: IconButtonProps) {
  const theme = useAppTheme();
  const resolvedColor = color === colors.text ? theme.colors.text : color;
  const resolvedBackground = backgroundColor === colors.card ? theme.colors.card : backgroundColor;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: resolvedBackground, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={name} size={size} color={resolvedColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center"
  }
});
