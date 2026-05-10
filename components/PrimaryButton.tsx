import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/constants/theme";

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "light" | "danger";
};

export default function PrimaryButton({ title, onPress, disabled, variant = "primary" }: PrimaryButtonProps) {
  const backgroundColor =
    variant === "danger" ? colors.danger : variant === "light" ? colors.secondary : colors.primary;
  const textColor = variant === "light" ? colors.text : colors.card;

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
