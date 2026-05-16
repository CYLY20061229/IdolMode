import { StyleSheet, Text, View } from "react-native";
import { shadow } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
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
  const theme = useAppTheme();
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
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>我的 bubble</Text>
      <View style={styles.grid}>
        {stats.map(([label, value]) => (
          <View key={label} style={[styles.stat, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.value, { color: theme.colors.primaryDeep }]}>{value}</Text>
            <Text style={[styles.label, { color: theme.colors.mutedText }]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadow,
    borderRadius: 28,
    padding: 18,
    gap: 14
  },
  title: {
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
    borderRadius: 20,
    padding: 13,
    gap: 5
  },
  value: {
    fontSize: 20,
    fontWeight: "900"
  },
  label: {
    fontSize: 12,
    lineHeight: 16
  }
});
