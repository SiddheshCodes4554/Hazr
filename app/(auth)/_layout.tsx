import React from "react";
import { Redirect, Stack } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useUser } from "../../src/features/auth/hooks/useUser";

/**
 * Route layout for authentication screens.
 * Redirects the user directly to the app features if they are logged in.
 */
export default function AuthLayout() {
  const { isAuthenticated, loading } = useUser();

  if (loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="hsl(var(--primary))" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
