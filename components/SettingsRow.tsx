import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";

type SettingsRowProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export default function SettingsRow({ title, icon }: SettingsRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={colors.primaryDeep} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
    </View>
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
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  }
});
