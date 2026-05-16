import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import OnboardingGuide from "@/components/OnboardingGuide";
import ProfileSetup from "@/components/ProfileSetup";
import { AppThemeProvider, useAppTheme } from "@/context/AppThemeContext";
import { IdolModeProvider, useIdolMode } from "@/context/IdolModeContext";
import { hasSeenOnboardingGuide, markOnboardingGuideSeen } from "@/services/onboardingGuide";

function AppNavigator() {
  const { isReady, isProfileComplete } = useIdolMode();
  const theme = useAppTheme();
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isReady || !isProfileComplete) return;
    void hasSeenOnboardingGuide().then((seen) => {
      if (!cancelled && !seen) setShowGuide(true);
    });
    return () => { cancelled = true; };
  }, [isReady, isProfileComplete]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!isProfileComplete) {
    return <ProfileSetup />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="artist/[id]" />
        <Stack.Screen name="self-chat" />
        <Stack.Screen name="confirm-send" />
        <Stack.Screen name="fan-messages" />
        <Stack.Screen name="idol-chat/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="my-profile" />
        <Stack.Screen name="my-memories" />
        <Stack.Screen name="api-diagnostics" />
        <Stack.Screen name="email-login" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="ai-disclosure" />
        <Stack.Screen name="account-deletion" />
      </Stack>
      <OnboardingGuide
        visible={showGuide}
        onFinish={() => {
          setShowGuide(false);
          void markOnboardingGuideSeen();
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <IdolModeProvider>
        <RootLayoutContent />
      </IdolModeProvider>
    </AppThemeProvider>
  );
}

function RootLayoutContent() {
  const theme = useAppTheme();
  return (
    <>
      <StatusBar style={theme.isDark ? "light" : "dark"} backgroundColor={theme.colors.background} />
      <AppNavigator />
    </>
  );
}
