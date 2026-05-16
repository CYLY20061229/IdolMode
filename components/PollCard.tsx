import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { Poll } from "@/types/idol";

type PollCardProps = {
  poll: Poll;
  dark?: boolean;
};

const OPTION_LABELS = ["A", "B", "C", "D"];

export default function PollCard({ poll, dark }: PollCardProps) {
  const [tick, setTick] = useState(0);
  const startedAt = poll.liveStartedAt
    ? new Date(poll.liveStartedAt).getTime()
    : Number(poll.id.match(/\d+/)?.[0]) || Date.now();
  const closesAt = new Date(poll.closesAt).getTime();
  const isClosed = poll.status === "closed" || Date.now() >= closesAt;

  useEffect(() => {
    if (isClosed) return;
    const timer = setInterval(() => setTick((value) => value + 1), 3500);
    return () => clearInterval(timer);
  }, [isClosed]);

  const { displayVotes, displayOptions } = useMemo(() => {
    if (isClosed) {
      const displayOptions = poll.options.map((option) => ({ ...option, displayPct: option.percentage }));
      return {
        displayVotes: poll.totalVotes,
        displayOptions
      };
    }

    const elapsedMs = Math.max(0, Date.now() - startedAt);
    const liveDelayMs = 3000;
    if (elapsedMs < liveDelayMs) {
      return {
        displayVotes: 0,
        displayOptions: poll.options.map((option) => ({ ...option, displayPct: 0 }))
      };
    }

    const totalMs = Math.max(1, closesAt - startedAt - liveDelayMs);
    const progress = Math.min((elapsedMs - liveDelayMs) / totalMs, 0.98);
    const easedProgress = 1 - Math.pow(1 - progress, 1.7);
    const startVotes = 0;
    const wave = Math.sin(startedAt / 1000 + tick * 0.75) * 0.015;
    const displayVotes = Math.min(
      poll.totalVotes,
      Math.max(startVotes, Math.floor(poll.totalVotes * (easedProgress * 0.98 + wave)))
    );

    const weights = poll.options.map((option, index) => {
      const base = Math.max(1, option.percentage);
      const phase = (startedAt % 97) + index * 1.83 + tick * 0.62;
      return Math.max(1, base + Math.sin(phase) * 3.2 + Math.cos(phase * 0.7) * 1.8);
    });
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    const rounded = weights.map((weight) => Math.max(1, Math.round((weight / totalWeight) * 100)));
    const delta = 100 - rounded.reduce((sum, value) => sum + value, 0);
    const largestIndex = rounded.reduce((best, value, index) => value > rounded[best] ? index : best, 0);
    rounded[largestIndex] = Math.max(1, rounded[largestIndex] + delta);
    const displayOptions = poll.options.map((option, index) => ({
      ...option,
      displayPct: rounded[index]
    }));

    return { displayVotes, displayOptions };
  }, [poll, isClosed, closesAt, startedAt, tick]);

  return (
    <View style={[styles.wrap, dark && styles.darkWrap]}>
      <View style={styles.headerRow}>
        <Text style={[styles.badge, dark && styles.darkBadge]}>投票</Text>
        <Text style={[styles.status, dark && styles.darkMuted]}>
          {isClosed ? "已结束" : "粉丝正在投票中"}
        </Text>
      </View>
      <Text style={[styles.question, dark && styles.darkText]}>{poll.question}</Text>

      <View style={styles.options}>
        {displayOptions.map((option, index) => {
          const isWinner = isClosed && option.id === poll.winningOptionId;
          const pct = option.displayPct;
          const label = OPTION_LABELS[index] ?? "";
          return (
            <View key={option.id} style={[styles.option, dark && styles.darkOption, isWinner && styles.winnerOption]}>
              {!isClosed && <View style={[styles.bar, { width: `${Math.max(4, pct)}%` as `${number}%` }]} />}
              <View style={styles.optionContent}>
                {label && (
                  <Text style={[styles.optionLabel, dark && styles.darkMuted]}>{label}.</Text>
                )}
                <Text style={[styles.optionText, dark && styles.darkText]} numberOfLines={2}>{option.text}</Text>
                <Text style={[styles.percent, dark && styles.darkMuted]}>{pct}%</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.footerRow}>
        <Text style={[styles.footerText, dark && styles.darkMuted]}>{displayVotes.toLocaleString()} 人已投票</Text>
        {isClosed ? (
          <Text style={[styles.footerText, styles.winnerText]}>
            {displayOptions.find((o) => o.id === poll.winningOptionId)?.text ?? ""}
          </Text>
        ) : (
          <Text style={[styles.footerText, dark && styles.darkMuted]}>
            截止 {poll.closesAt ? new Date(poll.closesAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-end",
    width: "82%",
    borderRadius: 22,
    borderBottomRightRadius: 8,
    padding: 15,
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 6
  },
  darkWrap: {
    backgroundColor: "#2A2138",
    borderColor: "#3C3150"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  badge: {
    overflow: "hidden",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: colors.secondary,
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: "900"
  },
  darkBadge: {
    backgroundColor: "rgba(191,167,242,0.16)",
    color: colors.primary
  },
  status: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "700"
  },
  question: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900"
  },
  darkText: {
    color: colors.card
  },
  options: {
    gap: 8
  },
  option: {
    minHeight: 40,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  darkOption: {
    backgroundColor: "#20182C",
    borderColor: "#3C3150"
  },
  winnerOption: {
    borderColor: colors.primary
  },
  bar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(191,167,242,0.24)"
  },
  optionContent: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  optionLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    width: 16
  },
  optionText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  percent: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "900"
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  footerText: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "700"
  },
  darkMuted: {
    color: "#BEB2CF"
  },
  winnerText: {
    color: colors.primaryDeep
  }
});