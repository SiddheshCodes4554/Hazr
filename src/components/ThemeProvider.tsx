import React, { createContext, useContext, useEffect } from "react";
import { useColorScheme as useReactNativeColorScheme } from "react-native";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import { useThemeStore, ThemeMode } from "../store/themeStore";

interface ThemeContextType {
  theme: ThemeMode;
  colorScheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

/**
 * Custom Provider wrapping NativeWind and Zustand Theme State.
 * Automatically synchronizes current state to Tailwind components.
 */
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { theme, setTheme } = useThemeStore();
  const systemColorScheme = useReactNativeColorScheme();
  const { setColorScheme } = useNativeWindColorScheme();

  // Resolve current visual theme (light or dark)
  const activeScheme =
    theme === "system"
      ? (systemColorScheme === "dark" ? "dark" : "light")
      : theme;

  useEffect(() => {
    // Notify NativeWind of color scheme changes
    setColorScheme(activeScheme);
  }, [activeScheme, setColorScheme]);

  return (
    <ThemeContext.Provider value={{ theme, colorScheme: activeScheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Custom hook to consume active theme state.
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export default ThemeProvider;
