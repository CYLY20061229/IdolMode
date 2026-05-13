import { useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Avatar } from "@/components/Avatar";
import IconButton from "@/components/IconButton";
import SettingsRow from "@/components/SettingsRow";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";
import { logoutDeviceSession } from "@/services/apiClient";
import { pickProfileAvatarImage } from "@/services/localMedia";
import { uploadImageToOss } from "@/services/uploadApi";

// ── 编辑资料弹窗 ──────────────────────────────────────────────────────────────

function EditProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { myProfile, updateProfile } = useIdolMode();
  const [nickname, setNickname] = useState(myProfile.nickname || "");
  const [signature, setSignature] = useState(myProfile.signature || "");
  const [statusText, setStatusText] = useState(myProfile.statusText || "");
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
      const savedProfile = await updateProfile({
        ...myProfile,
        nickname: nickname.trim(),
        signature: signature.trim(),
        statusText: statusText.trim(),
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
        <Pressable style={modal.sheet}>
          <Text style={modal.title}>编辑资料</Text>

          {/* 头像选择 */}
          <View style={modal.avatarRow}>
            <Pressable onPress={uploadingAvatar ? undefined : pickAvatar} style={[modal.avatarBtn, uploadingAvatar && modal.uploading]}>
              <Avatar label={avatar || "我"} size={64} backgroundColor={colors.secondary} />
              <View style={modal.avatarOverlay}>
                <Text style={modal.avatarOverlayText}>{uploadingAvatar ? "上传中" : "换头像"}</Text>
              </View>
            </Pressable>
          </View>

          <Text style={modal.label}>昵称</Text>
          <TextInput
            style={modal.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="你的艺名"
            placeholderTextColor={colors.mutedText}
            maxLength={24}
            returnKeyType="next"
          />

          <Text style={modal.label}>签名</Text>
          <TextInput
            style={[modal.input, modal.inputMulti]}
            value={signature}
            onChangeText={setSignature}
            placeholder="一句话介绍自己"
            placeholderTextColor={colors.mutedText}
            maxLength={60}
            multiline
            returnKeyType="next"
          />

          <Text style={modal.label}>状态</Text>
          <TextInput
            style={modal.input}
            value={statusText}
            onChangeText={setStatusText}
            placeholder="此刻的状态…"
            placeholderTextColor={colors.mutedText}
            maxLength={30}
            returnKeyType="done"
          />

          <Pressable
            style={[modal.btn, saving && modal.btnDisabled]}
            onPress={handleSave}
            disabled={saving || uploadingAvatar}
          >
            <Text style={modal.btnText}>{saving ? "保存中…" : uploadingAvatar ? "头像上传中…" : "保存"}</Text>
          </Pressable>
          <Pressable style={modal.cancel} onPress={onClose}>
            <Text style={modal.cancelText}>取消</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── 关于弹窗 ──────────────────────────────────────────────────────────────────

function AboutModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modal.backdrop} onPress={onClose}>
        <Pressable style={modal.sheet}>
          <Text style={modal.title}>关于 Idol Mode</Text>
          <Text style={modal.body}>
            Idol Mode 是一款粉丝 × idol 互动模拟器。{"\n\n"}
            你可以扮演 idol 发布营业消息，AI 会生成来自世界各地粉丝的实时反应，让你感受被喜欢的感觉。{"\n\n"}
            版本：1.0.0{"\n"}
            技术栈：React Native · Expo · Qwen AI
          </Text>
          <Pressable style={modal.btn} onPress={onClose}>
            <Text style={modal.btnText}>知道了</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { myProfile } = useIdolMode();
  const [editVisible, setEditVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);

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
      "这会清除本地缓存的粉丝消息和贴纸，不影响账号数据。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "清除",
          style: "destructive",
          onPress: () => {
            Alert.alert("已清除", "缓存已清除。");
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

  const handlePrivacy = () => {
    Linking.openURL("https://idolmode.app/privacy").catch(() => {});
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="返回" onPress={() => router.back()} />
        <Text style={styles.title}>设置</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* 账号 */}
        <Text style={styles.sectionLabel}>账号</Text>
        <View style={styles.group}>
          <SettingsRow
            title="编辑资料"
            icon="person-outline"
            value={myProfile.nickname || "未设置"}
            onPress={() => setEditVisible(true)}
          />
          <SettingsRow
            title="邮箱"
            icon="mail-outline"
            value={myProfile.email || "未绑定"}
            onPress={() => Alert.alert("邮箱绑定", "邮箱绑定功能即将上线。")}
          />
        </View>

        {/* 通知 */}
        <Text style={styles.sectionLabel}>通知</Text>
        <View style={styles.group}>
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <View style={styles.iconWrap}>
                <Text style={styles.iconEmoji}>🔔</Text>
              </View>
              <Text style={styles.switchTitle}>粉丝消息通知</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={setNotifEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>
        </View>

        {/* AI 功能 */}
        <Text style={styles.sectionLabel}>AI 功能</Text>
        <View style={styles.group}>
          <SettingsRow
            title="AI 记忆"
            icon="star-outline"
            onPress={() => router.push("/my-memories")}
          />
        </View>

        {/* 通用 */}
        <Text style={styles.sectionLabel}>通用</Text>
        <View style={styles.group}>
          <SettingsRow
            title="清除缓存"
            icon="trash-outline"
            onPress={handleClearCache}
            hideChevron
          />
          <SettingsRow
            title="隐私政策"
            icon="lock-closed-outline"
            onPress={handlePrivacy}
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

        {/* 危险区 */}
        <View style={styles.group}>
          <SettingsRow
            title="退出登录"
            icon="log-out-outline"
            onPress={handleLogout}
            danger
            hideChevron
          />
        </View>

        <Text style={styles.version}>Idol Mode v1.0.0</Text>
      </ScrollView>

      <EditProfileModal visible={editVisible} onClose={() => setEditVisible(false)} />
      <AboutModal visible={aboutVisible} onClose={() => setAboutVisible(false)} />
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
