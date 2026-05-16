import { Ionicons } from "@expo/vector-icons";
import { Text, View, StyleSheet } from "react-native";
import { useAppTheme } from "@/context/AppThemeContext";

type TabIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
};

export default function TabIcon({ name, label, focused }: TabIconProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.wrap}>
      <Ionicons name={name} size={22} color={focused ? theme.colors.primaryDeep : theme.colors.mutedText} />
      <Text style={[styles.label, { color: focused ? theme.colors.primaryDeep : theme.colors.mutedText }]}>{label}</Text>
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
    fontSize: 11,
    fontWeight: "700"
  }
});
