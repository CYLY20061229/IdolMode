import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Avatar } from "@/components/Avatar";
import IconButton from "@/components/IconButton";
import { colors, shadow, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";
import { pickProfileAvatarImage, pickProfileBackgroundImage } from "@/services/localMedia";
import { uploadImageToOss } from "@/services/uploadApi";

// ── 昵称 ──────────────────────────────────────────────────────────────────────

function GradientName({ name }: { name: string }) {
  return (
    <Text style={gn.name}>{name}</Text>
  );
}

const gn = StyleSheet.create({
  name: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0.5,
    textAlign: "center"
  }
});

// ── 渐变流光光圈头像 ──────────────────────────────────────────────────────────────
// 原理：LinearGradient 正方形旋转，外层圆形 overflow:hidden 裁成圆，
//       中间叠一个略小的白色实心圆遮住内部 → 形成渐变圆环
//       Animated 持续旋转 → 流光效果

const RING_SIZE = 102;   // 外圆直径
const AVATAR_SIZE = 86;  // 头像直径
const HOLE_SIZE = 96;    // 遮罩圆直径（RING_SIZE - 边框宽度*2）
// 渐变正方形边长需覆盖圆的对角线
const GRAD_SIZE = Math.ceil(RING_SIZE * 1.42);

function RingAvatar({ label, onPress }: { label: string; onPress: () => void }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();
  }, [rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  });

  return (
    <Pressable onPress={onPress} style={ring.wrap}>
      {/* 渐变旋转层，裁成圆 */}
      <View style={ring.clipCircle}>
        <Animated.View
          style={[
            ring.gradWrap,
            { transform: [{ rotate }] }
          ]}
        >
          <LinearGradient
            colors={["#C084FC", "#F0ABFC", "#BFA7F2", "#8F73D7", "#E879F9", "#C084FC"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={ring.gradient}
          />
        </Animated.View>
        {/* 中心遮罩：挖出圆环 */}
        <View style={ring.hole} />
      </View>
      {/* 头像居中叠放 */}
      <View style={ring.avatarWrap}>
        <Avatar label={label} size={AVATAR_SIZE} backgroundColor={colors.secondary} />
      </View>
    </Pressable>
  );
}

const ring = StyleSheet.create({
  wrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center"
  },
  // 圆形裁剪容器
  clipCircle: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center"
  },
  // 旋转容器，比圆大，保证旋转时不露白边
  gradWrap: {
    position: "absolute",
    width: GRAD_SIZE,
    height: GRAD_SIZE,
    alignItems: "center",
    justifyContent: "center"
  },
  gradient: {
    width: GRAD_SIZE,
    height: GRAD_SIZE
  },
  // 中心遮罩圆（背景色与页面一致）
  hole: {
    position: "absolute",
    width: HOLE_SIZE,
    height: HOLE_SIZE,
    borderRadius: HOLE_SIZE / 2,
    backgroundColor: colors.background
  },
  // 头像层
  avatarWrap: {
    position: "absolute",
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden"
  }
});

// ── 编辑资料弹窗 ────────────────────────────────────────────────────────────────

function EditModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
    if (uri && !uploadingAvatar) {
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
    }
  };

  const handleSave = async () => {
    if (!nickname.trim()) return;
    setSaving(true);
    try {
      const isImageAvatar = /^(https?):/.test(avatar);
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
      <Pressable style={em.backdrop} onPress={onClose}>
        <Pressable style={em.sheet}>
          <Text style={em.title}>编辑资料</Text>

          {/* 头像选择 */}
          <View style={em.avatarRow}>
            <Pressable onPress={uploadingAvatar ? undefined : pickAvatar} style={[em.avatarBtn, uploadingAvatar && em.uploading]}>
              <Avatar label={avatar || "我"} size={64} backgroundColor={colors.secondary} />
              <View style={em.avatarOverlay}>
                <Text style={em.avatarOverlayText}>{uploadingAvatar ? "上传中" : "换头像"}</Text>
              </View>
            </Pressable>
          </View>

          <Text style={em.label}>昵称</Text>
          <TextInput
            style={em.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="你的艺名"
            placeholderTextColor={colors.mutedText}
            maxLength={24}
            returnKeyType="next"
          />

          <Text style={em.label}>签名</Text>
          <TextInput
            style={[em.input, em.inputMulti]}
            value={signature}
            onChangeText={setSignature}
            placeholder="一句话介绍自己"
            placeholderTextColor={colors.mutedText}
            maxLength={60}
            multiline
            returnKeyType="next"
          />

          <Text style={em.label}>状态</Text>
          <TextInput
            style={em.input}
            value={statusText}
            onChangeText={setStatusText}
            placeholder="此刻的状态…"
            placeholderTextColor={colors.mutedText}
            maxLength={30}
            returnKeyType="next"
          />

          <Text style={em.label}>粉丝名（选填）</Text>
          <TextInput
            style={em.input}
            value={fanName}
            onChangeText={(text) => {
              const cleaned = text.replace(/[\r\n]/g, "").slice(0, 24);
              setFanName(cleaned);
            }}
            placeholder="给你的粉丝起个名字"
            placeholderTextColor={colors.mutedText}
            maxLength={24}
            returnKeyType="done"
          />

          <Pressable
            style={[em.btn, saving && em.btnDisabled]}
            onPress={handleSave}
            disabled={saving || uploadingAvatar}
          >
            <Text style={em.btnText}>{saving ? "保存中…" : uploadingAvatar ? "头像上传中…" : "保存"}</Text>
          </Pressable>
          <Pressable style={em.cancel} onPress={onClose}>
            <Text style={em.cancelText}>取消</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const em = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(47,42,53,0.28)",
    justifyContent: "flex-end",
    padding: 18
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    gap: 12
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: 4 },
  avatarRow: { alignItems: "center", marginBottom: 4 },
  avatarBtn: { position: "relative" },
  uploading: { opacity: 0.65 },
  avatarOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: "rgba(47,42,53,0.45)",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarOverlayText: { color: colors.card, fontSize: 10, fontWeight: "700" },
  label: { color: colors.mutedText, fontSize: 13, fontWeight: "700", marginBottom: -4 },
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
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  btn: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.card, fontSize: 15, fontWeight: "900" },
  cancel: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  cancelText: { color: colors.mutedText, fontSize: 14, fontWeight: "800" }
});

// ── 主页面 ────────────────────────────────────────────────────────────────────

export default function MyProfileScreen() {
  const { myProfile, updateProfile } = useIdolMode();
  const [editVisible, setEditVisible] = useState(false);
  const [backgroundUploading, setBackgroundUploading] = useState(false);

  const pickBackground = async () => {
    const uri = await pickProfileBackgroundImage();
    if (uri && !backgroundUploading) {
      setBackgroundUploading(true);
      try {
        const publicUrl = await uploadImageToOss(uri, "profile-background");
        await updateProfile({ ...myProfile, backgroundImage: publicUrl });
      } catch (error) {
        Alert.alert("背景保存失败", error instanceof Error ? error.message : "背景图片没有保存成功，请稍后再试。");
      } finally {
        setBackgroundUploading(false);
      }
    }
  };

  const removeBackground = () => {
    Alert.alert("移除背景", "确定要移除背景图片吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "移除",
        style: "destructive",
        onPress: () => {
          updateProfile({ ...myProfile, backgroundImage: undefined }).catch((error) => {
            Alert.alert("移除失败", error instanceof Error ? error.message : "背景图片没有移除成功，请稍后再试。");
          });
        }
      }
    ]);
  };

  const hasBackground = Boolean(myProfile.backgroundImage);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        bounces
      >
        {/* ── 背景区域 ── */}
        <View style={styles.bgWrap}>
          {hasBackground ? (
            <ImageBackground
              source={{ uri: myProfile.backgroundImage }}
              style={styles.bgImage}
              resizeMode="cover"
            >
              <View style={styles.bgOverlay} />
              <View style={[styles.deco, styles.decoA]} />
              <View style={[styles.deco, styles.decoB]} />
            </ImageBackground>
          ) : (
            <View style={styles.bgSolid}>
              <View style={[styles.deco, styles.decoA]} />
              <View style={[styles.deco, styles.decoB]} />
            </View>
          )}

          {/* 返回按钮 */}
          <View style={styles.backBtn}>
            <IconButton
              name="chevron-back"
              accessibilityLabel="返回"
              onPress={() => router.back()}
            />
          </View>

          {/* 修改背景按钮（右下角） */}
          <Pressable
            style={({ pressed }) => [styles.bgEditBtn, pressed && { opacity: 0.7 }]}
            onPress={backgroundUploading ? undefined : hasBackground ? removeBackground : pickBackground}
          >
            <Text style={styles.bgEditText}>
              {backgroundUploading ? "上传中…" : hasBackground ? "🗑 移除背景" : "修改背景"}
            </Text>
          </Pressable>
        </View>

        {/* ── 头像 + 名字区域 ── */}
        <View style={styles.profileArea}>
          <RingAvatar
            label={myProfile.avatar || "我"}
            onPress={() => setEditVisible(true)}
          />

          <View style={styles.nameBlock}>
            <GradientName name={myProfile.nickname || "未设置昵称"} />
            {myProfile.statusText ? (
              <Text style={styles.statusText}>{myProfile.statusText}</Text>
            ) : null}
          </View>

          {/* 签名 */}
          <View style={styles.sigRow}>
            <Text style={styles.signature}>
              {myProfile.signature || "还没有签名"}
            </Text>
            <Pressable onPress={() => setEditVisible(true)} style={styles.editTag}>
              <Text style={styles.editTagText}>✏️</Text>
            </Pressable>
          </View>

          {/* 标签行 */}
          <View style={styles.pillRow}>
            <Text style={styles.pill}>✨ Idol</Text>
            {myProfile.gender ? (
              <Text style={styles.pill}>
                {myProfile.gender === "female" ? "👩 女生" :
                 myProfile.gender === "male" ? "👦 男生" : "🌈 非二元"}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ── 编辑按钮 ── */}
        <Pressable
          style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.8 }]}
          onPress={() => setEditVisible(true)}
        >
          <Text style={styles.editBtnText}>编辑资料</Text>
        </Pressable>

        <View style={styles.bottomPad} />
      </ScrollView>

      <EditModal visible={editVisible} onClose={() => setEditVisible(false)} />
    </View>
  );
}

// ── 样式 ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    flexGrow: 1
  },

  // 背景
  bgWrap: {
    height: 220,
    position: "relative"
  },
  bgImage: {
    flex: 1
  },
  bgSolid: {
    flex: 1,
    backgroundColor: colors.secondary,   // #F3D7E5 粉紫色
    overflow: "hidden"
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(191,167,242,0.18)"  // primary 半透明叠层
  },
  deco: {
    position: "absolute",
    borderRadius: 999
  },
  decoA: {
    width: 180,
    height: 180,
    right: -40,
    top: -40,
    backgroundColor: `${colors.primary}30`   // #BFA7F2 18%
  },
  decoB: {
    width: 120,
    height: 120,
    left: 30,
    bottom: -30,
    backgroundColor: `${colors.primaryDeep}20`  // #8F73D7 12%
  },

  // 返回按钮
  backBtn: {
    position: "absolute",
    top: 54,
    left: 12
  },

  // 修改背景按钮
  bgEditBtn: {
    position: "absolute",
    bottom: 14,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow
  },
  bgEditText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700"
  },

  // 头像 + 名字
  profileArea: {
    alignItems: "center",
    marginTop: -52,
    paddingHorizontal: spacing.screen,
    gap: 10
  },
  nameBlock: {
    alignItems: "center",
    gap: 4
  },
  statusText: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: "600"
  },
  sigRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  signature: {
    color: colors.mutedText,
    fontSize: 14,
    textAlign: "center",
    flexShrink: 1
  },
  editTag: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  editTagText: {
    fontSize: 12
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4
  },
  pill: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.secondary,
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border
  },

  // 编辑按钮
  editBtn: {
    marginHorizontal: spacing.screen,
    marginTop: 28,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow
  },
  editBtnText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: "900"
  },

  bottomPad: {
    height: 60
  }
});
