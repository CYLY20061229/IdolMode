import { Pressable, StyleSheet, Text } from "react-native";
import { useAppTheme } from "@/context/AppThemeContext";

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "light" | "danger";
};

export default function PrimaryButton({ title, onPress, disabled, variant = "primary" }: PrimaryButtonProps) {
  const theme = useAppTheme();
  const backgroundColor =
    variant === "danger" ? theme.colors.danger : variant === "light" ? theme.colors.secondary : theme.colors.primary;
  const textColor = variant === "light" ? theme.colors.text : theme.colors.card;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: disabled ? 0.55 : pressed ? 0.75 : 1 }
      ]}
    >
      <Text style={[styles.text, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  text: {
    fontSize: 16,
    fontWeight: "800"
  }
});
