import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import IconButton from "@/components/IconButton";
import { colors, spacing } from "@/constants/theme";
import { LegalDocument } from "@/constants/legalDocuments";
import { useAppTheme } from "@/context/AppThemeContext";

type LegalDocumentScreenProps = {
  document: LegalDocument;
};

export default function LegalDocumentScreen({ document }: LegalDocumentScreenProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="返回" onPress={() => router.back()} />
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>{document.title}</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[styles.updatedAt, { color: theme.colors.mutedText }]}>更新日期：{document.updatedAt}</Text>
        {document.sections.map((section) => (
          <View key={section.heading} style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.heading, { color: theme.colors.text }]}>{section.heading}</Text>
            {section.body.map((paragraph) => (
              <Text key={paragraph} style={[styles.paragraph, { color: theme.colors.mutedText }]}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
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
    justifyContent: "space-between",
    gap: 12
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center"
  },
  spacer: {
    width: 38
  },
  content: {
    paddingTop: 22,
    paddingBottom: 60,
    gap: 12
  },
  updatedAt: {
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 2,
    marginBottom: 2
  },
  section: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 9
  },
  heading: {
    fontSize: 16,
    fontWeight: "900"
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22
  }
});
