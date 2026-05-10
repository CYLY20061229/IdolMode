import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { IdolModeProvider } from "@/context/IdolModeContext";
import { colors } from "@/constants/theme";

export default function RootLayout() {
  return (
    <IdolModeProvider>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="artist/[id]" />
        <Stack.Screen name="self-chat" />
        <Stack.Screen name="confirm-send" />
        <Stack.Screen name="fan-messages" />
        <Stack.Screen name="idol-chat/[id]" />
        <Stack.Screen name="settings" />
      </Stack>
    </IdolModeProvider>
  );
}
