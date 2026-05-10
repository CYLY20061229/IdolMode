import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Avatar } from "@/components/Avatar";
import IconButton from "@/components/IconButton";
import MyBubbleStats from "@/components/MyBubbleStats";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";

const faqs = ["What is Idol Mode?", "How do fan messages work?", "Can I edit my profile?"];

export default function MoreScreen() {
  const { myProfile } = useIdolMode();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
        <IconButton name="settings-outline" accessibilityLabel="Open settings" onPress={() => router.push("/settings")} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <Avatar label={myProfile.avatar} size={104} />
          <Text style={styles.name}>{myProfile.nickname}</Text>
          <Text style={styles.email}>{myProfile.email}</Text>
        </View>

        <MyBubbleStats />

        <View style={styles.faq}>
          <Text style={styles.sectionTitle}>FAQ</Text>
          {faqs.map((item) => (
            <View key={item} style={styles.faqRow}>
              <Text style={styles.faqText}>{item}</Text>
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
    backgroundColor: colors.background,
    paddingTop: 58,
    paddingHorizontal: spacing.screen
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    color: colors.text,
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
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 5
  },
  email: {
    color: colors.mutedText,
    fontSize: 14
  },
  faq: {
    gap: 10
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  faqRow: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15
  },
  faqText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  }
});
