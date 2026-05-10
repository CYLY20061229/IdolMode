import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { IdolModeProvider, useIdolMode } from "@/context/IdolModeContext";
import { colors } from "@/constants/theme";

function AppNavigator() {
  const { isReady } = useIdolMode();

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="artist/[id]" />
      <Stack.Screen name="self-chat" />
      <Stack.Screen name="confirm-send" />
      <Stack.Screen name="fan-messages" />
      <Stack.Screen name="idol-chat/[id]" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <IdolModeProvider>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <AppNavigator />
    </IdolModeProvider>
  );
}
