import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import IconButton from "@/components/IconButton";
import PrimaryButton from "@/components/PrimaryButton";
import { colors, spacing } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { useIdolMode } from "@/context/IdolModeContext";
import { AccountMe, apiDeleteAccount, apiFetchMe, apiLoginWithEmail, apiSendEmailCode, logoutDeviceSession } from "@/services/apiClient";

function normalizeEmailInput(value: string) {
  return value.trim().toLowerCase().slice(0, 254);
}

type PageState = "loading" | "bound" | "login" | "logout_confirm";

export default function EmailLoginScreen() {
  const theme = useAppTheme();
  const { refreshSessionData } = useIdolMode();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [account, setAccount] = useState<AccountMe | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const canSendCode = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && countdown <= 0 && !sendingCode, [email, countdown, sendingCode]);

  useEffect(() => {
    let cancelled = false;
    void apiFetchMe().then((data) => {
      if (cancelled) return;
      setAccount(data);
      if (data?.user?.isEmailVerified && data?.user?.emailMasked) {
        setPageState("bound");
      } else {
        setPageState("login");
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((current) => Math.max(current - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const sendCode = async () => {
    if (!canSendCode) return;
    setSendingCode(true);
    try {
      const result = await apiSendEmailCode(email);
      setCountdown(result.cooldownSeconds || 60);
    } catch (error) {
      // 静默失败，验证码发送按钮仍可重试
    } finally {
      setSendingCode(false);
    }
  };

  const handleLogin = async () => {
    setSubmitting(true);
    try {
      const result = await apiLoginWithEmail(email, code);
      await refreshSessionData();
      setAccount(result);
      setPageState("bound");
    } catch (error) {
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogoutConfirm = async () => {
    try {
      await logoutDeviceSession();
    } catch {
      // 网络失败也继续退出
    }
    setAccount(null);
    setPageState("login");
    setEmail("");
    setCode("");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "删除账号",
      "删除后邮箱信息会删除或匿名化，聊天记录、AI 记忆、营业值、粉丝数、用户偏好会删除，上传图片/语音会从 OSS 删除或进入异步删除队列，所有 token 会失效。此操作不可恢复。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "确认删除",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "再次确认删除",
              "请再次确认：账号删除后无法恢复，当前账号将退出登录。",
              [
                { text: "取消", style: "cancel" },
                {
                  text: "删除账号",
                  style: "destructive",
                  onPress: async () => {
                    setDeletingAccount(true);
                    try {
                      await apiDeleteAccount();
                      setAccount(null);
                      setEmail("");
                      setCode("");
                      router.replace("/");
                    } catch (error) {
                      Alert.alert("删除失败", error instanceof Error ? error.message : "账号没有删除成功，请稍后再试。");
                    } finally {
                      setDeletingAccount(false);
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="返回" onPress={() => router.back()} />
        <Text style={[styles.title, { color: theme.colors.text }]}>邮箱账号</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {pageState === "loading" ? (
          <View style={styles.loadingWrap}>
            <Text style={[styles.loadingText, { color: theme.colors.mutedText }]}>加载中…</Text>
          </View>
        ) : pageState === "bound" && account?.user ? (
          /* ── 已绑定邮箱 ── */
          <View style={styles.boundWrap}>
            <View style={[styles.boundCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.boundHeader}>
                <Text style={[styles.boundLabel, { color: theme.colors.mutedText }]}>邮箱账号</Text>
                <View style={[styles.boundBadge, { backgroundColor: theme.colors.secondary }]}>
                  <Text style={[styles.boundBadgeText, { color: theme.colors.primaryDeep }]}>已绑定</Text>
                </View>
              </View>
              <Text style={[styles.boundEmail, { color: theme.colors.text }]}>
                {account.user.emailMasked}
              </Text>
              <Text style={[styles.boundHint, { color: theme.colors.mutedText }]}>
                这个邮箱用于登录 Idol Mode、保存你的聊天记录、营业值、粉丝数和会员权益。
              </Text>
            </View>

            <View style={[styles.accountCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.resultRow}>
                <Text style={[styles.resultLabel, { color: theme.colors.mutedText }]}>权益</Text>
                <View style={[styles.planBadge, { backgroundColor: theme.colors.secondary }]}>
                  <Text style={[styles.planBadgeText, { color: theme.colors.primaryDeep }]}>
                    {account.entitlement?.plan === "paid" ? "付费版" : "免费版"}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.resultRow}>
                <Text style={[styles.resultLabel, { color: theme.colors.mutedText }]}>Guest 数据</Text>
                <View style={styles.dataStatus}>
                  <Text style={styles.checkmark}>✓</Text>
                  <Text style={[styles.dataStatusText, { color: theme.colors.mutedText }]}>已保留</Text>
                </View>
              </View>
            </View>

            <PrimaryButton title="退出登录" onPress={() => setPageState("logout_confirm")} />
            <View style={[styles.deleteCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.deleteTitle, { color: theme.colors.danger }]}>删除账号</Text>
              <Text style={[styles.deleteBody, { color: theme.colors.mutedText }]}>
                邮箱信息将删除或匿名化；聊天记录、AI 记忆、营业值、粉丝数和用户偏好将删除；上传图片/语音会从 OSS 删除或进入异步删除队列；token 将失效。
              </Text>
              <Pressable
                disabled={deletingAccount}
                onPress={handleDeleteAccount}
                style={({ pressed }) => [
                  styles.deleteButton,
                  { borderColor: theme.colors.danger },
                  pressed && { opacity: 0.65 },
                  deletingAccount && styles.disabled
                ]}
              >
                <Text style={[styles.deleteButtonText, { color: theme.colors.danger }]}>
                  {deletingAccount ? "删除中..." : "删除账号"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : pageState === "logout_confirm" ? (
          /* ── 退出确认 ── */
          <View style={styles.confirmWrap}>
            <View style={[styles.confirmIconWrap, { backgroundColor: theme.colors.card }]}>
              <Text style={styles.confirmIcon}>⚠</Text>
            </View>
            <Text style={[styles.confirmTitle, { color: theme.colors.text }]}>退出登录</Text>
            <Text style={[styles.confirmBody, { color: theme.colors.mutedText }]}>
              退出后本地数据不会丢失，下次登录可以继续使用。
            </Text>
            <View style={styles.confirmActions}>
              <PrimaryButton title="取消" variant="light" onPress={() => setPageState("bound")} />
              <PrimaryButton title="确认退出" onPress={handleLogoutConfirm} />
            </View>
          </View>
        ) : (
          /* ── 未绑定，显示登录表单 ── */
          <>
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>绑定后数据不会丢</Text>
              <Text style={[styles.cardBody, { color: theme.colors.mutedText }]}>
                当前 Guest 聊天、粉丝消息、营业值和粉丝数会自动迁移到邮箱账号。
              </Text>
            </View>

            <View style={styles.form}>
              <Text style={[styles.label, { color: theme.colors.mutedText }]}>邮箱</Text>
              <TextInput
                value={email}
                onChangeText={(value) => setEmail(normalizeEmailInput(value))}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="user@example.com"
                placeholderTextColor={theme.colors.mutedText}
                style={[styles.input, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }]}
              />

              <Text style={[styles.label, { color: theme.colors.mutedText }]}>验证码</Text>
              <View style={styles.codeRow}>
                <TextInput
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  placeholder="6 位验证码"
                  placeholderTextColor={theme.colors.mutedText}
                  style={[styles.input, styles.codeInput, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }]}
                />
                <Pressable
                  disabled={!canSendCode}
                  onPress={sendCode}
                  style={[styles.codeButton, { backgroundColor: theme.colors.secondary }, !canSendCode && styles.disabled]}
                >
                  <Text style={[styles.codeButtonText, { color: theme.colors.text }]}>
                    {countdown > 0 ? `${countdown}s` : sendingCode ? "发送中" : "获取验证码"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <PrimaryButton
              title={submitting ? "登录中…" : "邮箱验证码登录 / 注册"}
              disabled={submitting || !email || code.length !== 6}
              onPress={handleLogin}
            />

            <Text style={[styles.notice, { color: theme.colors.mutedText }]}>
              登录即表示你已阅读并同意
              <Text style={styles.link} onPress={() => router.push("/terms")}>《用户协议》</Text>
              和
              <Text style={styles.link} onPress={() => router.push("/privacy")}>《隐私政策》</Text>
              。
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 54,
    paddingHorizontal: spacing.screen
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    fontSize: 20,
    fontWeight: "900"
  },
  spacer: {
    width: 38
  },
  content: {
    paddingTop: 24,
    paddingBottom: 70,
    gap: 18
  },
  loadingWrap: {
    paddingTop: 48,
    alignItems: "center"
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "700"
  },
  boundWrap: {
    gap: 16,
    alignItems: "stretch"
  },
  boundCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 10
  },
  boundHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  boundLabel: {
    fontSize: 13,
    fontWeight: "800"
  },
  boundBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  boundBadgeText: {
    fontSize: 12,
    fontWeight: "900"
  },
  boundEmail: {
    fontSize: 17,
    fontWeight: "900"
  },
  boundHint: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 2
  },
  accountCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden"
  },
  deleteCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 10
  },
  deleteTitle: {
    fontSize: 17,
    fontWeight: "900"
  },
  deleteBody: {
    fontSize: 13,
    lineHeight: 20
  },
  deleteButton: {
    minHeight: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "900"
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 15
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: "700"
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.06)",
    marginHorizontal: 18
  },
  planBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: "900"
  },
  dataStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  checkmark: {
    fontSize: 16,
    fontWeight: "900"
  },
  dataStatusText: {
    fontSize: 14,
    fontWeight: "700"
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 8
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900"
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 21
  },
  form: {
    gap: 9
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 2
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 15,
    fontSize: 16,
    fontWeight: "700"
  },
  codeRow: {
    flexDirection: "row",
    gap: 10
  },
  codeInput: {
    flex: 1
  },
  codeButton: {
    minWidth: 108,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  codeButtonText: {
    fontSize: 14,
    fontWeight: "900"
  },
  disabled: {
    opacity: 0.55
  },
  notice: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  },
  link: {
    color: colors.primaryDeep,
    fontWeight: "900"
  },
  confirmWrap: {
    paddingTop: 48,
    gap: 20,
    alignItems: "stretch"
  },
  confirmIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center"
  },
  confirmIcon: {
    fontSize: 38
  },
  confirmTitle: {
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center"
  },
  confirmBody: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center"
  },
  confirmActions: {
    gap: 10,
    marginTop: 8
  }
});
