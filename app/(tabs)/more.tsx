import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Avatar } from "@/components/Avatar";
import IconButton from "@/components/IconButton";
import MyBubbleStats from "@/components/MyBubbleStats";
import { colors, spacing } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { useIdolMode } from "@/context/IdolModeContext";
import { AccountMe, apiFetchMe } from "@/services/apiClient";

const faqs = [
  {
    question: "我的聊天内容会被用来做什么？",
    answer: "用于生成粉丝反应、保存聊天记录和提供沉浸式体验。具体见隐私政策。"
  },
  {
    question: "邮箱有什么用？",
    answer: "用于登录、保存账号数据和未来会员权益。"
  },
  {
    question: "清除缓存会删除账号吗？",
    answer: "不会。清除缓存只删除本地临时文件，不会删除账号、聊天记录、营业值和粉丝数。"
  },
  {
    question: "怎么反馈问题？",
    answer: "可以通过设置页的反馈入口联系我们。"
  }
];

export default function MoreScreen() {
  const theme = useAppTheme();
  const { myProfile, growthStats, fanMessages } = useIdolMode();
  const [account, setAccount] = useState<AccountMe | null>(null);

  useEffect(() => {
    void apiFetchMe().then((data) => {
      if (data) setAccount(data);
    });
  }, []);

  const emailText = account?.user?.emailMasked ?? "邮箱可在设置中绑定";

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>更多</Text>
        <IconButton name="settings-outline" accessibilityLabel="打开设置" onPress={() => router.push("/settings")} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <Avatar label={myProfile.avatar} size={104} />
          <Text style={[styles.name, { color: theme.colors.text }]}>{myProfile.nickname}</Text>
          <Text style={[styles.email, { color: theme.colors.mutedText }]}>{emailText}</Text>
        </View>

        <MyBubbleStats growthStats={growthStats} fanMessageCount={fanMessages.length} />

        <View style={styles.faq}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>常见问题</Text>
          {faqs.map((item) => (
            <View key={item.question} style={[styles.faqRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>{item.question}</Text>
              <Text style={[styles.faqAnswer, { color: theme.colors.mutedText }]}>{item.answer}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 58,
    paddingHorizontal: spacing.screen
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    fontSize: 34,
    fontWeight: "900"
  },
  content: {
    paddingTop: 26,
    paddingBottom: 116,
    gap: 22
  },
  profile: {
    alignItems: "center",
    gap: 7
  },
  name: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 5
  },
  email: {
    fontSize: 14
  },
  faq: {
    gap: 10
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900"
  },
  faqRow: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 15
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: "700"
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6
  }
});
