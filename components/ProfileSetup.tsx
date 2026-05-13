import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import PrimaryButton from "@/components/PrimaryButton";
import { colors, spacing } from "@/constants/theme";
import { useIdolMode } from "@/context/IdolModeContext";
import { Profile } from "@/types/idol";

const genderOptions: Array<{ label: string; value: NonNullable<Profile["gender"]> }> = [
  { label: "女生", value: "female" },
  { label: "男生", value: "male" },
  { label: "非二元", value: "nonbinary" },
  { label: "不想透露", value: "prefer_not_to_say" }
];

export default function ProfileSetup() {
  const { myProfile, updateProfile } = useIdolMode();
  const [gender, setGender] = useState<Profile["gender"]>(myProfile.gender || "female");
  const [ageText, setAgeText] = useState(myProfile.age ? String(myProfile.age) : "");
  const [nickname, setNickname] = useState(myProfile.nickname === "New Idol" || myProfile.nickname === "新艺人" ? "" : myProfile.nickname);

  const age = Number(ageText);
  const validAge = Number.isInteger(age) && age >= 13 && age <= 120;
  const canContinue = Boolean(gender && validAge);

  const submit = () => {
    if (!canContinue) return;
    const nextNickname = nickname.trim() || (myProfile.nickname === "New Idol" ? "新艺人" : myProfile.nickname) || "新艺人";
    updateProfile({
      ...myProfile,
      nickname: nextNickname,
      avatar: nextNickname.slice(0, 2).toUpperCase(),
      gender,
      age
    }).catch(() => {
      // Keep the setup screen open; profile save errors are surfaced in full edit screens.
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Idol Mode</Text>
        <Text style={styles.title}>完善你的 bubble 资料</Text>
        <Text style={styles.copy}>这会帮助我们调整粉丝消息的语气，也会把你的账号保存在这台设备上。</Text>

        <View style={styles.field}>
          <Text style={styles.label}>昵称</Text>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="新艺人"
            placeholderTextColor={colors.mutedText}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>性别</Text>
          <View style={styles.segmentWrap}>
            {genderOptions.map((option) => {
              const selected = gender === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setGender(option.value)}
                  style={[styles.segment, selected && styles.segmentSelected]}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>年龄</Text>
          <TextInput
            value={ageText}
            onChangeText={(value) => setAgeText(value.replace(/[^0-9]/g, "").slice(0, 3))}
            placeholder="18"
            placeholderTextColor={colors.mutedText}
            keyboardType="number-pad"
            style={styles.input}
          />
          {ageText.length > 0 && !validAge ? <Text style={styles.hint}>年龄需要在 13 到 120 岁之间。</Text> : null}
        </View>

        <PrimaryButton title="继续" onPress={submit} disabled={!canContinue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    paddingHorizontal: spacing.screen
  },
  panel: {
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    gap: 18
  },
  eyebrow: {
    color: colors.primaryDeep,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  },
  copy: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21
  },
  field: {
    gap: 8
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  input: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 15
  },
  segmentWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  segment: {
    minHeight: 40,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: "center",
    paddingHorizontal: 12
  },
  segmentSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  segmentText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "800"
  },
  segmentTextSelected: {
    color: colors.card
  },
  hint: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700"
  }
});
