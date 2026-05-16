import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Memory, MemoryType } from "@/types/idol";
import { deleteMemory, fetchMemories, suppressMemory, writeMemory } from "@/services/memoryApi";
import { colors, shadow, spacing } from "@/constants/theme";
import IconButton from "@/components/IconButton";

// ── 记忆类型标签 ──────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<MemoryType, string> = {
  preference: "偏好",
  habit: "习惯",
  life_event: "未来事件",
  creative_context: "故事",
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
  const [writeVisible, setWriteVisible] = useState(false);
  const [writeContent, setWriteContent] = useState("");
  const [writeType, setWriteType] = useState<MemoryType>("life_event");
  const [writing, setWriting] = useState(false);

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

  const handleWrite = async () => {
    const trimmed = writeContent.trim();
    if (!trimmed) return;
    setWriting(true);
    const ok = await writeMemory(trimmed, writeType);
    if (ok) {
      setWriteContent("");
      setWriteVisible(false);
      void load();
    } else {
      Alert.alert("写入失败", "请稍后再试。");
    }
    setWriting(false);
  };

  const active = memories.filter((m) => !m.user_suppressed);
  const suppressed = memories.filter((m) => m.user_suppressed);

  return (
    <View style={styles.screen}>
      {/* 顶栏 */}
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => router.back()} accessibilityLabel="返回" />
        <Text style={styles.title}>记忆与日程</Text>
        <Pressable
          onPress={() => setWriteVisible(true)}
          style={({ pressed }) => [styles.writeBtn, pressed && styles.writeBtnPressed]}
        >
          <Ionicons name="add" size={22} color={colors.card} />
        </Pressable>
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

      {/* 写入记忆弹窗 */}
      <Modal visible={writeVisible} transparent animationType="slide" onRequestClose={() => setWriteVisible(false)}>
        <Pressable style={writeModal.backdrop} onPress={() => setWriteVisible(false)}>
          <Pressable style={[writeModal.sheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
            <Text style={writeModal.title}>写入记忆</Text>
            <Text style={[writeModal.label, { color: colors.mutedText }]}>类型</Text>
            <View style={writeModal.typeRow}>
              {(["life_event", "preference", "habit", "creative_context", "emotion"] as MemoryType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setWriteType(t)}
                  style={[writeModal.typeChip, writeType === t && { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep }]}
                >
                  <Text style={[writeModal.typeChipText, writeType === t && { color: colors.card }]}>{TYPE_LABEL[t]}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[writeModal.label, { color: colors.mutedText }]}>内容</Text>
            <TextInput
              style={[writeModal.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={writeContent}
              onChangeText={setWriteContent}
              placeholder="写下你想让 AI 记住的内容…"
              placeholderTextColor={colors.mutedText}
              multiline
              maxLength={300}
            />
            <Text style={writeModal.charCount}>{writeContent.length}/300</Text>
            <View style={writeModal.actions}>
              <Pressable style={[writeModal.btn, { backgroundColor: colors.background }]} onPress={() => setWriteVisible(false)}>
                <Text style={[writeModal.btnText, { color: colors.mutedText }]}>取消</Text>
              </Pressable>
              <Pressable
                style={[writeModal.btn, { backgroundColor: colors.primaryDeep }, writing && { opacity: 0.65 }]}
                onPress={handleWrite}
                disabled={writing || !writeContent.trim()}
              >
                <Text style={[writeModal.btnText, { color: colors.card }]}>{writing ? "写入中…" : "写入"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  writeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  writeBtnPressed: {
    opacity: 0.75,
  },
});

const writeModal = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(47,42,53,0.28)",
    justifyContent: "flex-end",
    padding: 18,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: -4,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.mutedText,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    minHeight: 88,
    fontSize: 15,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 11,
    color: colors.mutedText,
    textAlign: "right",
    marginTop: -4,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 15,
    fontWeight: "900",
  },
});
