import { StyleSheet, Text, View } from "react-native";
import { colors, shadow } from "@/constants/theme";

const stats = [
  ["My Fans", "12,408"],
  ["Messages Received This Month", "3,284"],
  ["Compared to Last Month", "+18%"],
  ["Active Fan Rate", "76%"]
];

export default function MyBubbleStats() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>MY bubble</Text>
      <View style={styles.grid}>
        {stats.map(([label, value]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadow,
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 18,
    gap: 14
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  stat: {
    width: "47%",
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 13,
    gap: 5
  },
  value: {
    color: colors.primaryDeep,
    fontSize: 20,
    fontWeight: "900"
  },
  label: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16
  }
});
