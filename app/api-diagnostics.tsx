import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import IconButton from "@/components/IconButton";
import PrimaryButton from "@/components/PrimaryButton";
import { colors, spacing } from "@/constants/theme";
import { authDevice, fetchBootstrap, getSessionToken, getUserId } from "@/services/apiClient";
import { fetchGrowthStats } from "@/services/growthApi";

const apiBaseUrl = process.env.EXPO_PUBLIC_IDOL_MODE_API_URL?.replace(/\/$/, "") ?? "";

type Status = "idle" | "running" | "success" | "warning" | "error";

type DiagnosticResult = {
  key: string;
  label: string;
  status: Status;
  detail: string;
  durationMs?: number;
};

function maskValue(value: string): string {
  if (!value) return "empty";
  if (value.length <= 8) return `${value.slice(0, 2)}*** (${value.length} chars)`;
  return `${value.slice(0, 4)}...${value.slice(-4)} (${value.length} chars)`;
}

function errorToString(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function measure<T>(fn: () => Promise<T>): Promise<{ value: T; durationMs: number }> {
  const startedAt = Date.now();
  const value = await fn();
  return { value, durationMs: Date.now() - startedAt };
}

function statusColor(status: Status) {
  if (status === "success") return colors.success;
  if (status === "warning") return colors.primaryDeep;
  if (status === "error") return colors.danger;
  if (status === "running") return colors.primary;
  return colors.mutedText;
}

export default function ApiDiagnosticsScreen() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [running, setRunning] = useState(false);

  const upsertResult = useCallback((result: DiagnosticResult) => {
    setResults((current) => {
      const index = current.findIndex((item) => item.key === result.key);
      if (index === -1) return [...current, result];
      const next = [...current];
      next[index] = result;
      return next;
    });
  }, []);

  const runDiagnostics = useCallback(async () => {
    setRunning(true);
    setResults([]);

    const urlWarnings = [];
    if (!apiBaseUrl) urlWarnings.push("API URL is empty.");
    if (/localhost|127\.0\.0\.1/.test(apiBaseUrl)) urlWarnings.push("localhost in an APK points to the phone itself.");

    upsertResult({
      key: "config",
      label: "Config",
      status: urlWarnings.length ? "error" : "success",
      detail: [`Platform: ${Platform.OS}`, `API URL: ${apiBaseUrl || "empty"}`, ...urlWarnings].join("\n")
    });

    try {
      const [userId, sessionToken] = await Promise.all([getUserId(), getSessionToken()]);
      upsertResult({
        key: "identity-before",
        label: "Stored identity before auth",
        status: userId || sessionToken ? "success" : "warning",
        detail: `userId: ${maskValue(userId)}\nsessionToken: ${maskValue(sessionToken)}`
      });
    } catch (error) {
      upsertResult({
        key: "identity-before",
        label: "Stored identity before auth",
        status: "error",
        detail: errorToString(error)
      });
    }

    if (!apiBaseUrl) {
      setRunning(false);
      return;
    }

    upsertResult({ key: "health", label: "GET /health", status: "running", detail: "Requesting..." });
    try {
      const { value: response, durationMs } = await measure(() => fetch(`${apiBaseUrl}/health`));
      const text = await response.text();
      upsertResult({
        key: "health",
        label: "GET /health",
        status: response.ok ? "success" : "error",
        detail: `HTTP ${response.status}\n${text.slice(0, 240)}`,
        durationMs
      });
    } catch (error) {
      upsertResult({
        key: "health",
        label: "GET /health",
        status: "error",
        detail: errorToString(error)
      });
    }

    upsertResult({ key: "auth", label: "authDevice()", status: "running", detail: "Requesting..." });
    try {
      const { value: userId, durationMs } = await measure(() => authDevice());
      upsertResult({
        key: "auth",
        label: "authDevice()",
        status: userId ? "success" : "error",
        detail: `returned userId: ${maskValue(userId ?? "")}`,
        durationMs
      });
    } catch (error) {
      upsertResult({
        key: "auth",
        label: "authDevice()",
        status: "error",
        detail: errorToString(error)
      });
    }

    try {
      const [userId, sessionToken] = await Promise.all([getUserId(), getSessionToken()]);
      upsertResult({
        key: "identity-after",
        label: "Stored identity after auth",
        status: userId || sessionToken ? "success" : "warning",
        detail: `userId: ${maskValue(userId)}\nsessionToken: ${maskValue(sessionToken)}`
      });
    } catch (error) {
      upsertResult({
        key: "identity-after",
        label: "Stored identity after auth",
        status: "error",
        detail: errorToString(error)
      });
    }

    upsertResult({ key: "bootstrap", label: "fetchBootstrap()", status: "running", detail: "Requesting..." });
    try {
      const { value: bootstrap, durationMs } = await measure(() => fetchBootstrap());
      upsertResult({
        key: "bootstrap",
        label: "fetchBootstrap()",
        status: bootstrap ? "success" : "error",
        detail: bootstrap
          ? [
              `profile: ${bootstrap.profile ? "present" : "missing"}`,
              `recommendedArtists: ${bootstrap.recommendedArtists?.length ?? 0}`,
              `addedArtists: ${bootstrap.addedArtists?.length ?? 0}`,
              `selfMessages: ${bootstrap.selfMessages?.length ?? 0}`,
              `fanMessages: ${bootstrap.fanMessages?.length ?? 0}`,
              `idolThreads: ${bootstrap.idolThreads?.length ?? 0}`
            ].join("\n")
          : "returned null",
        durationMs
      });
    } catch (error) {
      upsertResult({
        key: "bootstrap",
        label: "fetchBootstrap()",
        status: "error",
        detail: errorToString(error)
      });
    }

    upsertResult({ key: "growth", label: "fetchGrowthStats()", status: "running", detail: "Requesting..." });
    try {
      const { value: growth, durationMs } = await measure(() => fetchGrowthStats());
      upsertResult({
        key: "growth",
        label: "fetchGrowthStats()",
        status: growth ? "success" : "error",
        detail: growth
          ? [
              `followers: ${growth.followers}`,
              `dailyBusinessValue: ${growth.dailyBusinessValue}/${growth.maxDailyBusinessValue}`,
              `streakDays: ${growth.streakDays}`,
              `totalEcho: ${growth.totalEcho}`
            ].join("\n")
          : "returned null",
        durationMs
      });
    } catch (error) {
      upsertResult({
        key: "growth",
        label: "fetchGrowthStats()",
        status: "error",
        detail: errorToString(error)
      });
    } finally {
      setRunning(false);
    }
  }, [upsertResult]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="返回" onPress={() => router.back()} />
        <Text style={styles.title}>API Diagnostics</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>手机端后端连接诊断</Text>
          <Text style={styles.introText}>用于确认 APK 是否带了 API 地址、是否能访问后端、是否能拿到用户和成长数据。</Text>
        </View>

        <PrimaryButton title={running ? "Running..." : "Run diagnostics"} disabled={running} onPress={runDiagnostics} />

        {running && results.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}

        {results.map((result) => (
          <View key={result.key} style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultLabel}>{result.label}</Text>
              <Text style={[styles.resultStatus, { color: statusColor(result.status) }]}>{result.status.toUpperCase()}</Text>
            </View>
            {typeof result.durationMs === "number" ? <Text style={styles.duration}>{result.durationMs}ms</Text> : null}
            <Text selectable style={styles.detail}>{result.detail}</Text>
          </View>
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
    paddingTop: 22,
    paddingBottom: 48,
    gap: 14
  },
  introCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8
  },
  introTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  introText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 20
  },
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  resultLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  resultStatus: {
    fontSize: 12,
    fontWeight: "900"
  },
  duration: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700"
  },
  detail: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19
  }
});
