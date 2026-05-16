import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";

const pages = [
  {
    title: "欢迎！",
    body: "在这里，你可以像爱豆一样发消息。你说一句话，后台粉丝会等待、回应、发疯、关心你。"
  },
  {
    title: "发一条消息",
    body: "试着分享今天的状态，比如“今天练习到很晚”“刚下课，好累”，也可以发语音，图片和投票。粉丝会根据你的内容给出反应。点击FROM FAN的表情包，可以查看具体反应，长按可以引用粉丝的回复。"
  },
  {
    title: "经营你的粉丝后台",
    body: "你的营业会影响粉丝数和营业值。经常出现，粉丝会更活跃；连续营业，会获得额外奖励。粉丝数量在”更多“页面查看"
  },
  {
    title: "登录与使用",
    body: "在“更多”页面的右上角的设置里，可以进行登录，修改使用偏好与一系列对账号的管理"
  }
];

type OnboardingGuideProps = {
  visible: boolean;
  onFinish: () => void;
};

export default function OnboardingGuide({ visible, onFinish }: OnboardingGuideProps) {
  const theme = useAppTheme();
  const [index, setIndex] = useState(0);
  const page = pages[index];
  const isLast = index === pages.length - 1;

  const finish = () => {
    setIndex(0);
    onFinish();
  };

  const next = () => {
    if (isLast) {
      finish();
      return;
    }
    setIndex((current) => Math.min(current + 1, pages.length - 1));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={finish}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <View style={styles.dots}>
            {pages.map((item, itemIndex) => (
              <View
                key={item.title}
                style={[
                  styles.dot,
                  { backgroundColor: itemIndex === index ? theme.colors.primaryDeep : theme.colors.border }
                ]}
              />
            ))}
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>{page.title}</Text>
          <Text style={[styles.body, { color: theme.colors.mutedText }]}>{page.body}</Text>
          <View style={styles.actions}>
            {index > 0 ? (
              <Pressable style={styles.secondaryButton} onPress={() => setIndex((current) => Math.max(current - 1, 0))}>
                <Text style={[styles.secondaryText, { color: theme.colors.mutedText }]}>上一页</Text>
              </Pressable>
            ) : <View style={styles.secondaryButton} />}
            <Pressable style={[styles.primaryButton, { backgroundColor: theme.colors.primaryDeep }]} onPress={next}>
              <Text style={styles.primaryText}>{isLast ? "开始营业" : "下一页"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.screen,
    backgroundColor: "rgba(18,14,26,0.58)"
  },
  card: {
    borderRadius: 24,
    padding: 22,
    gap: 18
  },
  dots: {
    flexDirection: "row",
    gap: 7
  },
  dot: {
    width: 22,
    height: 5,
    borderRadius: 3
  },
  title: {
    fontSize: 26,
    fontWeight: "900"
  },
  body: {
    fontSize: 16,
    lineHeight: 25
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4
  },
  secondaryButton: {
    minWidth: 76,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "800"
  },
  primaryButton: {
    minWidth: 116,
    minHeight: 44,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  primaryText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: "900"
  }
});
