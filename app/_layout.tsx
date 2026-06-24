import "../global.css";
import React from "react";
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient, asyncStoragePersister } from "../src/api/queryClient";
import { ThemeProvider, useTheme } from "../src/components/ThemeProvider";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { useSyncQueue } from "../src/features/offline/hooks/useSyncQueue";

export const unstable_settings = {
  anchor: "(tabs)",
};

/**
 * Inner App Layout component.
 * Executes offline queues and consumes the theme state to apply styling
 * to the underlying expo-router and navigation modules.
 */
function AppContent() {
  const { colorScheme } = useTheme();
  
  // Activate the offline-sync worker daemon
  useSyncQueue();

  return (
    <NavigationThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </NavigationThemeProvider>
  );
}

/**
 * Root Application Entry Layout.
 * Sets up global react-query cache persisters, error boundaries,
 * and NativeWind theme configurations.
 */
export default function RootLayout() {
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: asyncStoragePersister,
          maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days cache validation age
        }}
      >
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}
