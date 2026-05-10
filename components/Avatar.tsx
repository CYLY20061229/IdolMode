import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";

type AvatarProps = {
  label: string;
  size?: number;
  backgroundColor?: string;
};

export function Avatar({ label, size = 52, backgroundColor = colors.secondary }: AvatarProps) {
  const isGraphicLabel = /[^\w\s]/.test(label);

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor }]}>
      <Text style={[styles.label, isGraphicLabel && styles.graphicLabel, { fontSize: Math.max(13, size * (isGraphicLabel ? 0.5 : 0.34)) }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center"
  },
  label: {
    color: colors.primaryDeep,
    fontWeight: "800"
  },
  graphicLabel: {
    color: colors.text,
    fontWeight: "400"
  }
});
