import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Memory, MemoryType } from "@/types/idol";
import { deleteMemory, fetchMemories, suppressMemory } from "@/services/memoryApi";
import { colors, shadow, spacing } from "@/constants/theme";
import IconButton from "@/components/IconButton";

// ── 记忆类型标签 ──────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<MemoryType, string> = {
  preference: "偏好",
  habit: "习惯",
  life_event: "生活事件",
  creative_context: "创作背景",
  emotion: "情绪",
};

const TYPE_COLOR: Record<MemoryType, string> = {
  preference: "#BFA7F2",
  habit: "#77BFA3",
  life_event: "#F3D7E5",
  creative_context: "#DCEEFF",
  emotion: "#F9C784",
};

// ── 重要度星星 ────────────────────────────────────────────────────────────────

function ImportanceDots({ value }: { value: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: 5 }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: i < value ? colors.primary : colors.border },
          ]}
        />
      ))}
    </View>
  );
}

// ── 单条记忆卡片 ──────────────────────────────────────────────────────────────

type MemoryCardProps = {
  memory: Memory;
  onDelete: (id: string) => void;
  onSuppress: (id: string) => void;
};

function MemoryCard({ memory, onDelete, onSuppress }: MemoryCardProps) {
  const typeLabel = TYPE_LABEL[memory.memory_type] ?? memory.memory_type;
  const tagColor = TYPE_COLOR[memory.memory_type] ?? colors.border;

  const handleDelete = () => {
    Alert.alert("删除记忆", "删除后 AI 将永远不再使用这条记忆，确定吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => onDelete(memory.id),
      },
    ]);
  };

  const handleSuppress = () => {
    Alert.alert(
      "不再提起",
      "AI 将不再主动提及这条记忆，但记录仍会保留。确定吗？",
      [
        { text: "取消", style: "cancel" },
        { text: "确定", onPress: () => onSuppress(memory.id) },
      ]
    );
  };

  return (
    <View style={[styles.card, memory.user_suppressed && styles.cardSuppressed]}>
      <View style={styles.cardTop}>
        <View style={[styles.typeTag, { backgroundColor: tagColor }]}>
          <Text style={styles.typeTagText}>{typeLabel}</Text>
        </View>
        <ImportanceDots value={memory.importance} />
        {memory.user_suppressed && (
          <View style={styles.suppressedBadge}>
            <Text style={styles.suppressedText}>已屏蔽</Text>
          </View>
        )}
      </View>

      <Text style={[styles.content, memory.user_suppressed && styles.contentMuted]}>
        {memory.content}
      </Text>

      {memory.mention_count > 0 && (
        <Text style={styles.meta}>
          粉丝提及过 {memory.mention_count} 次
        </Text>
      )}

      <View style={styles.actions}>
        {!memory.user_suppressed && (
          <Pressable
            onPress={handleSuppress}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          >
            <Ionicons name="eye-off-outline" size={14} color={colors.mutedText} />
            <Text style={styles.actionText}>不再提起</Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [styles.actionBtn, styles.actionBtnDanger, pressed && styles.actionBtnPressed]}
        >
          <Ionicons name="trash-outline" size={14} color={colors.danger} />
          <Text style={[styles.actionText, { color: colors.danger }]}>删除</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

export default function MyMemoriesScreen() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchMemories();
    setMemories(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    const ok = await deleteMemory(id);
    if (ok) setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSuppress = async (id: string) => {
    const ok = await suppressMemory(id);
    if (ok) {
      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, user_suppressed: true } : m))
      );
    }
  };

  const active = memories.filter((m) => !m.user_suppressed);
  const suppressed = memories.filter((m) => m.user_suppressed);

  return (
    <View style={styles.screen}>
      {/* 顶栏 */}
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => router.back()} accessibilityLabel="返回" />
        <Text style={styles.title}>AI 记忆</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : memories.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="star-outline" size={48} color={colors.border} />
          <Text style={styles.emptyTitle}>还没有记忆</Text>
          <Text style={styles.emptyDesc}>
            当你发布营业消息后，AI 会自动从中提取有意义的内容，让粉丝的反应更贴近你。
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          <Text style={styles.sectionHint}>
            AI 会在生成粉丝消息时，自然地引用这些记忆。你可以随时删除或屏蔽不想被提及的内容。
          </Text>

          {active.map((m) => (
            <MemoryCard
              key={m.id}
              memory={m}
              onDelete={handleDelete}
              onSuppress={handleSuppress}
            />
          ))}

          {suppressed.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>已屏蔽</Text>
              {suppressed.map((m) => (
                <MemoryCard
                  key={m.id}
                  memory={m}
                  onDelete={handleDelete}
                  onSuppress={handleSuppress}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── 样式 ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screen,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.mutedText,
    marginTop: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.mutedText,
    textAlign: "center",
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 40,
    gap: 12,
  },
  sectionHint: {
    fontSize: 12,
    color: colors.mutedText,
    lineHeight: 18,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.mutedText,
    marginTop: 8,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // 卡片
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    ...shadow,
  },
  cardSuppressed: {
    opacity: 0.6,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  typeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 3,
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  suppressedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: colors.border,
    marginLeft: "auto",
  },
  suppressedText: {
    fontSize: 10,
    color: colors.mutedText,
  },
  content: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  contentMuted: {
    color: colors.mutedText,
  },
  meta: {
    fontSize: 11,
    color: colors.mutedText,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnDanger: {
    borderColor: "#F9D0D6",
    backgroundColor: "#FFF5F6",
  },
  actionBtnPressed: {
    opacity: 0.7,
  },
  actionText: {
    fontSize: 12,
    color: colors.mutedText,
  },
});
