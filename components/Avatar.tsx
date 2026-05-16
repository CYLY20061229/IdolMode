import { Image, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/context/AppThemeContext";

type AvatarProps = {
  label: string;
  size?: number;
  backgroundColor?: string;
};

export function Avatar({ label, size = 52, backgroundColor }: AvatarProps) {
  const theme = useAppTheme();
  const isImageUri = /^(file|content|data|https?):/.test(label);
  const isGraphicLabel = /[^\w\s]/.test(label);
  const resolvedBackground = backgroundColor ?? theme.colors.secondary;

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: resolvedBackground }]}>
      {isImageUri ? (
        <Image source={{ uri: label }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
      ) : (
        <Text style={[
          styles.label,
          { color: isGraphicLabel ? theme.colors.text : theme.colors.primaryDeep, fontSize: Math.max(13, size * (isGraphicLabel ? 0.5 : 0.34)) }
        ]}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  image: {
    resizeMode: "cover"
  },
  label: {
    fontWeight: "800"
  }
});
