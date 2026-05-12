import { StyleSheet, Text, View } from "react-native";
import { colors, shadow } from "@/constants/theme";
import { IdolGrowthStats } from "@/types/idol";

type MyBubbleStatsProps = {
  growthStats: IdolGrowthStats | null;
  fanMessageCount: number;
};

function formatFollowers(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
}

export default function MyBubbleStats({ growthStats, fanMessageCount }: MyBubbleStatsProps) {
  const followers = growthStats ? formatFollowers(growthStats.followers) : "—";
  const dailyPct = growthStats
    ? `${Math.round((growthStats.dailyBusinessValue / growthStats.maxDailyBusinessValue) * 100)}%`
    : "—";
  const streak = growthStats ? `${growthStats.streakDays} 天` : "—";
  const msgCount = fanMessageCount > 0 ? fanMessageCount.toLocaleString() : "—";

  const stats = [
    ["我的粉丝", followers],
    ["今日营业值", dailyPct],
    ["连续营业", streak],
    ["收到消息", msgCount]
  ] as const;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>我的 bubble</Text>
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
