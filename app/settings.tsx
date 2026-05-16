import { useCallback, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Avatar } from "@/components/Avatar";
import IconButton from "@/components/IconButton";
import SettingsRow from "@/components/SettingsRow";
import { colors, spacing } from "@/constants/theme";
import { ThemeMode, useAppTheme } from "@/context/AppThemeContext";
import { useIdolMode } from "@/context/IdolModeContext";
import { AccountMe, apiDeleteAccount, apiFetchMe, apiUpdatePreferences, logoutDeviceSession } from "@/services/apiClient";
import { clearAppCache } from "@/services/cacheApi";
import { pickProfileAvatarImage } from "@/services/localMedia";
import { resetOnboardingGuide } from "@/services/onboardingGuide";
import { uploadImageToOss } from "@/services/uploadApi";

// ── 编辑资料弹窗 ──────────────────────────────────────────────────────────────

function EditProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  const { myProfile, updateProfile } = useIdolMode();
  const [nickname, setNickname] = useState(myProfile.nickname || "");
  const [signature, setSignature] = useState(myProfile.signature || "");
  const [statusText, setStatusText] = useState(myProfile.statusText || "");
  const [fanName, setFanName] = useState(myProfile.fanName || "");
  const [avatar, setAvatar] = useState(myProfile.avatar || "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const pickAvatar = async () => {
    const uri = await pickProfileAvatarImage();
    if (!uri || uploadingAvatar) return;
    setAvatar(uri);
    setUploadingAvatar(true);
    try {
      const publicUrl = await uploadImageToOss(uri, "avatar");
      setAvatar(publicUrl);
    } catch {
      Alert.alert("上传失败", "头像没有上传成功，请重新选择。");
      setAvatar(myProfile.avatar || "");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!nickname.trim()) return;
    setSaving(true);
    try {
      const isImageAvatar = /^(https?):/.test(avatar);
      // Clean fanName: strip @ prefix, trim, no newlines, max 24 chars
      let cleanFanName: string | null = null;
      const rawFanName = fanName.replace(/[\r\n]/g, "");
      if (rawFanName.trim().length > 0) {
        const cleaned = rawFanName.trim().replace(/^@+/, "").replace(/\s+/g, " ").trim();
        if (cleaned.length > 0) {
          cleanFanName = cleaned.slice(0, 24);
        }
      }
      const savedProfile = await updateProfile({
        ...myProfile,
        nickname: nickname.trim(),
        signature: signature.trim(),
        statusText: statusText.trim(),
        fanName: cleanFanName,
        avatar: isImageAvatar ? avatar : (avatar.slice(0, 3).toUpperCase() || "我")
      });
      setAvatar(savedProfile.avatar || "");
      onClose();
    } catch (error) {
      Alert.alert("保存失败", error instanceof Error ? error.message : "资料没有保存成功，请稍后再试。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modal.backdrop} onPress={onClose}>
        <Pressable style={[modal.sheet, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[modal.title, { color: theme.colors.text }]}>编辑资料</Text>

          {/* 头像选择 */}
          <View style={modal.avatarRow}>
            <Pressable onPress={uploadingAvatar ? undefined : pickAvatar} style={[modal.avatarBtn, uploadingAvatar && modal.uploading]}>
              <Avatar label={avatar || "我"} size={64} backgroundColor={colors.secondary} />
              <View style={modal.avatarOverlay}>
                <Text style={modal.avatarOverlayText}>{uploadingAvatar ? "上传中" : "换头像"}</Text>
              </View>
            </Pressable>
          </View>

          <Text style={[modal.label, { color: theme.colors.mutedText }]}>昵称</Text>
          <TextInput
            style={[modal.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
            value={nickname}
            onChangeText={setNickname}
            placeholder="你的艺名"
            placeholderTextColor={theme.colors.mutedText}
            maxLength={24}
            returnKeyType="next"
          />

          <Text style={[modal.label, { color: theme.colors.mutedText }]}>签名</Text>
          <TextInput
            style={[modal.input, modal.inputMulti, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
            value={signature}
            onChangeText={setSignature}
            placeholder="一句话介绍自己"
            placeholderTextColor={theme.colors.mutedText}
            maxLength={60}
            multiline
            returnKeyType="next"
          />

          <Text style={[modal.label, { color: theme.colors.mutedText }]}>状态</Text>
          <TextInput
            style={[modal.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
            value={statusText}
            onChangeText={setStatusText}
            placeholder="此刻的状态…"
            placeholderTextColor={theme.colors.mutedText}
            maxLength={30}
            returnKeyType="next"
          />

          <Text style={[modal.label, { color: theme.colors.mutedText }]}>粉丝名（选填）</Text>
          <TextInput
            style={[modal.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
            value={fanName}
            onChangeText={(text) => {
              const cleaned = text.replace(/[\r\n]/g, "").slice(0, 24);
              setFanName(cleaned);
            }}
            placeholder="给你的粉丝起个名字"
            placeholderTextColor={theme.colors.mutedText}
            maxLength={24}
            returnKeyType="done"
          />

          <Pressable
            style={[modal.btn, { backgroundColor: theme.colors.primary }, saving && modal.btnDisabled]}
            onPress={handleSave}
            disabled={saving || uploadingAvatar}
          >
            <Text style={[modal.btnText, { color: theme.colors.card }]}>{saving ? "保存中…" : uploadingAvatar ? "头像上传中…" : "保存"}</Text>
          </Pressable>
          <Pressable style={modal.cancel} onPress={onClose}>
            <Text style={[modal.cancelText, { color: theme.colors.mutedText }]}>取消</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── 关于弹窗 ──────────────────────────────────────────────────────────────────

function AboutModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modal.backdrop} onPress={onClose}>
        <Pressable style={[modal.sheet, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[modal.title, { color: theme.colors.text }]}>关于 Idol Mode</Text>
          <Text style={[modal.body, { color: theme.colors.mutedText }]}>
            Idol Mode 是一款粉丝 × idol 互动模拟器。{"\n\n"}
            你可以扮演 idol 发布营业消息，AI 会生成来自世界各地粉丝的实时反应，让你感受被喜欢的感觉。{"\n\n"}
            版本：1.0.0{"\n"}
            技术栈：React Native · Expo · Qwen AI
          </Text>
          <Pressable style={[modal.btn, { backgroundColor: theme.colors.primary }]} onPress={onClose}>
            <Text style={[modal.btnText, { color: theme.colors.card }]}>知道了</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AppearanceModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  const options: Array<{ label: string; value: ThemeMode }> = [
    { label: "浅色模式", value: "light" },
    { label: "深色模式", value: "dark" }
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modal.backdrop} onPress={onClose}>
        <Pressable style={[modal.sheet, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[modal.title, { color: theme.colors.text }]}>外观</Text>
          {options.map((option) => {
            const selected = theme.themeMode === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  void theme.setThemeMode(option.value);
                  onClose();
                }}
                style={[modal.optionRow, { backgroundColor: selected ? theme.colors.secondary : theme.colors.background }]}
              >
                <Text style={[modal.optionText, { color: theme.colors.text }]}>{option.label}</Text>
                <Text style={[modal.optionCheck, { color: theme.colors.primaryDeep }]}>{selected ? "✓" : ""}</Text>
              </Pressable>
            );
          })}
          <Pressable style={modal.cancel} onPress={onClose}>
            <Text style={[modal.cancelText, { color: theme.colors.mutedText }]}>取消</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const theme = useAppTheme();
  const { myProfile, refreshPreferences } = useIdolMode();
  const [editVisible, setEditVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [appearanceVisible, setAppearanceVisible] = useState(false);
  const [account, setAccount] = useState<AccountMe | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [autoTranslateEnabled, setAutoTranslateEnabled] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [savingTranslate, setSavingTranslate] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const themeLabel = theme.themeMode === "dark" ? "深色模式" : "浅色模式";
  const emailMasked = account?.user?.emailMasked || "";

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void apiFetchMe().then((data) => {
        if (!cancelled) {
          setAccount(data);
          setNotifEnabled(Boolean(data?.preferences?.fanNotificationsEnabled));
          setAutoTranslateEnabled(Boolean(data?.preferences?.autoTranslateEnabled));
        }
      });
      return () => { cancelled = true; };
    }, [])
  );

  const handleLogout = () => {
    Alert.alert(
      "退出登录",
      "退出后本地数据不会丢失，下次登录可以继续使用。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "退出",
          style: "destructive",
          onPress: async () => {
            try {
              await logoutDeviceSession();
            } catch {
              // 网络失败也继续退出
            }
            router.replace("/");
          }
        }
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      "清除缓存",
      "将清除临时图片、语音和本地缓存，不会删除账号、聊天记录和营业值。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "清除",
          style: "destructive",
          onPress: async () => {
            setClearingCache(true);
            try {
              await clearAppCache();
              Alert.alert("缓存已清理");
            } catch {
              Alert.alert("清理失败，请稍后重试");
            } finally {
              setClearingCache(false);
            }
          }
        }
      ]
    );
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    const previous = notifEnabled;
    setNotifEnabled(enabled);
    setSavingNotif(true);
    try {
      const preferences = await apiUpdatePreferences({ fanNotificationsEnabled: enabled });
      setNotifEnabled(preferences.fanNotificationsEnabled);
      setAccount((current) => current ? { ...current, preferences } : current);
    } catch {
      setNotifEnabled(previous);
      Alert.alert("保存失败", "粉丝通知设置没有保存成功，请稍后再试。");
    } finally {
      setSavingNotif(false);
    }
  };

  const handleAutoTranslateToggle = async (enabled: boolean) => {
    const previous = autoTranslateEnabled;
    setAutoTranslateEnabled(enabled);
    setSavingTranslate(true);
    try {
      const preferences = await apiUpdatePreferences({ autoTranslateEnabled: enabled });
      setAutoTranslateEnabled(preferences.autoTranslateEnabled);
      setAccount((current) => current ? { ...current, preferences } : current);
      await refreshPreferences();
    } catch {
      setAutoTranslateEnabled(previous);
      Alert.alert("保存失败", "一键翻译设置没有保存成功，请稍后再试。");
    } finally {
      setSavingTranslate(false);
    }
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

  const handleFeedback = () => {
    Linking.openURL("mailto:feedback@idolmode.app?subject=Idol Mode 反馈").catch(() => {
      Alert.alert("无法打开邮件", "请发送邮件至 feedback@idolmode.app");
    });
  };

  const handleReplayGuide = async () => {
    await resetOnboardingGuide();
    Alert.alert("已重置", "下次打开 App 时会重新显示使用指引。");
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="返回" onPress={() => router.back()} />
        <Text style={[styles.title, { color: theme.colors.text }]}>设置</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* 账号 */}
        <Text style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>账号</Text>
        <View style={styles.group}>
          <SettingsRow
            title="编辑资料"
            icon="person-outline"
            value={myProfile.nickname || "未设置"}
            onPress={() => setEditVisible(true)}
          />
          <SettingsRow
            title={emailMasked ? "邮箱" : "邮箱登录 / 绑定"}
            icon="mail-outline"
            value={emailMasked || "Guest"}
            onPress={() => router.push("/email-login")}
          />
        </View>

        {/* 通知 */}
        <Text style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>通知</Text>
        <View style={styles.group}>
          <View style={[styles.switchRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.switchLeft}>
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.background }]}>
                <Text style={styles.iconEmoji}>🔔</Text>
              </View>
              <Text style={[styles.switchTitle, { color: theme.colors.text }]}>粉丝消息通知</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={handleNotificationToggle}
              disabled={savingNotif}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.card}
            />
          </View>
        </View>

        {/* AI 功能 */}
        <Text style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>AI 功能</Text>
        <View style={styles.group}>
          <SettingsRow
            title="记忆与日程"
            icon="star-outline"
            onPress={() => router.push("/my-memories")}
          />
        </View>

        {/* 通用 */}
        <Text style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>通用</Text>
        <View style={styles.group}>
          <SettingsRow
            title="外观"
            icon="contrast-outline"
            value={themeLabel}
            onPress={() => setAppearanceVisible(true)}
          />
          <View style={[styles.switchRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.switchLeft}>
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.background }]}>
                <Text style={styles.iconEmoji}>译</Text>
              </View>
              <Text style={[styles.switchTitle, { color: theme.colors.text }]}>一键翻译</Text>
            </View>
            <Switch
              value={autoTranslateEnabled}
              onValueChange={handleAutoTranslateToggle}
              disabled={savingTranslate}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.card}
            />
          </View>
          <SettingsRow
            title={clearingCache ? "清除中..." : "清除缓存"}
            icon="trash-outline"
            onPress={clearingCache ? undefined : handleClearCache}
            hideChevron
          />
          <SettingsRow
            title="重新查看使用指引"
            icon="help-circle-outline"
            onPress={handleReplayGuide}
          />
          <SettingsRow
            title="意见反馈"
            icon="chatbubble-ellipses-outline"
            onPress={handleFeedback}
          />
          <SettingsRow
            title="关于 Idol Mode"
            icon="information-circle-outline"
            onPress={() => setAboutVisible(true)}
          />
        </View>

        {/* 隐私与协议 */}
        <Text style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>隐私与协议</Text>
        <View style={styles.group}>
          <SettingsRow
            title="用户协议"
            icon="document-text-outline"
            onPress={() => router.push("/terms")}
          />
          <SettingsRow
            title="隐私政策"
            icon="lock-closed-outline"
            onPress={() => router.push("/privacy")}
          />
          <SettingsRow
            title="AI 生成内容说明"
            icon="color-wand-outline"
            onPress={() => router.push("/ai-disclosure")}
          />
          <SettingsRow
            title="账号删除说明"
            icon="person-remove-outline"
            onPress={() => router.push("/account-deletion")}
          />
        </View>

        {/* 危险区 */}
        {emailMasked ? (
          <>
            <Text style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>账号删除</Text>
            <View style={styles.group}>
              <SettingsRow
                title={deletingAccount ? "删除中..." : "删除账号"}
                icon="person-remove-outline"
                onPress={deletingAccount ? undefined : handleDeleteAccount}
                danger
                hideChevron
              />
            </View>
          </>
        ) : null}

        <View style={styles.group}>
          <SettingsRow
            title="退出登录"
            icon="log-out-outline"
            onPress={handleLogout}
            danger
            hideChevron
          />
        </View>

        <Text style={[styles.version, { color: theme.colors.mutedText }]}>Idol Mode v1.0.0</Text>
      </ScrollView>

      <EditProfileModal visible={editVisible} onClose={() => setEditVisible(false)} />
      <AboutModal visible={aboutVisible} onClose={() => setAboutVisible(false)} />
      <AppearanceModal visible={appearanceVisible} onClose={() => setAppearanceVisible(false)} />
    </View>
  );
}

// ── 样式 ──────────────────────────────────────────────────────────────────────

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
    paddingBottom: 60,
    gap: 8
  },
  sectionLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 4,
    marginLeft: 4
  },
  group: {
    gap: 8
  },
  switchRow: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  switchLeft: {
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
  iconEmoji: {
    fontSize: 16
  },
  switchTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  version: {
    color: colors.mutedText,
    fontSize: 12,
    textAlign: "center",
    marginTop: 24
  }
});

const modal = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(47,42,53,0.28)",
    justifyContent: "flex-end",
    padding: 18
  },
  avatarRow: {
    alignItems: "center",
    marginBottom: 4
  },
  avatarBtn: {
    position: "relative"
  },
  uploading: {
    opacity: 0.65
  },
  avatarOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: "rgba(47,42,53,0.55)",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarOverlayText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700"
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    gap: 12
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4
  },
  label: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: -4
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600"
  },
  inputMulti: {
    minHeight: 72,
    textAlignVertical: "top"
  },
  body: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 22
  },
  optionRow: {
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  optionText: {
    fontSize: 15,
    fontWeight: "800"
  },
  optionCheck: {
    fontSize: 17,
    fontWeight: "900"
  },
  btn: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  btnDisabled: {
    opacity: 0.5
  },
  btnText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: "900"
  },
  cancel: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  cancelText: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "800"
  }
});
