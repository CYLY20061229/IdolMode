import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import IconButton from "@/components/IconButton";
import SettingsRow from "@/components/SettingsRow";
import { colors, spacing } from "@/constants/theme";

const rows = [
  { title: "Account", icon: "person-outline" as const },
  { title: "Notification", icon: "notifications-outline" as const },
  { title: "Language", icon: "language-outline" as const },
  { title: "Privacy", icon: "lock-closed-outline" as const },
  { title: "About", icon: "information-circle-outline" as const }
];

export default function SettingsScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => router.back()} />
        <Text style={styles.title}>Settings</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {rows.map((row) => (
          <SettingsRow key={row.title} title={row.title} icon={row.icon} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 54,
    paddingHorizontal: spacing.screen
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900"
  },
  spacer: {
    width: 38
  },
  content: {
    paddingTop: 24,
    paddingBottom: 50,
    gap: 12
  }
});
