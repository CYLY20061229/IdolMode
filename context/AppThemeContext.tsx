import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { AppColors, darkColors, lightColors } from "@/constants/theme";

export type ThemeMode = "light" | "dark";

type AppThemeContextValue = {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: AppColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
};

const THEME_MODE_KEY = "idol_mode_theme_mode";
const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function normalizeThemeMode(value: string | null): ThemeMode {
  return value === "dark" ? "dark" : "light";
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    let cancelled = false;
    async function loadThemeMode() {
      try {
        const stored = await AsyncStorage.getItem(THEME_MODE_KEY);
        if (!cancelled) setThemeModeState(normalizeThemeMode(stored));
      } catch {
        // Theme preference is optional.
      }
    }
    void loadThemeMode();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo<AppThemeContextValue>(() => {
    const setThemeMode = async (mode: ThemeMode) => {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_MODE_KEY, mode);
    };

    return {
      themeMode,
      isDark: themeMode === "dark",
      colors: themeMode === "dark" ? darkColors : lightColors,
      setThemeMode
    };
  }, [themeMode]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used inside AppThemeProvider");
  }
  return context;
}
