import AsyncStorage from "@react-native-async-storage/async-storage";

export const ONBOARDING_GUIDE_KEY = "guide:hasSeenOnboarding";

export async function hasSeenOnboardingGuide(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_GUIDE_KEY)) === "true";
}

export async function markOnboardingGuideSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_GUIDE_KEY, "true");
}

export async function resetOnboardingGuide(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_GUIDE_KEY);
}
