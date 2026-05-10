import { Ionicons } from "@expo/vector-icons";
import { Text, View, StyleSheet } from "react-native";
import { colors } from "@/constants/theme";

type TabIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
};

export default function TabIcon({ name, label, focused }: TabIconProps) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={name} size={22} color={focused ? colors.primaryDeep : colors.mutedText} />
      <Text style={[styles.label, focused && styles.focused]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minWidth: 70
  },
  label: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "700"
  },
  focused: {
    color: colors.primaryDeep
  }
});
