import React from "react";
import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

/**
 * Fallback screen for undefined/missing routes.
 */
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!", headerShown: true }} />
      <View className="flex-1 items-center justify-center p-6 bg-background">
        <Text className="text-foreground text-lg font-bold mb-2 select-none">
          {"This screen doesn't exist."}
        </Text>
        <Link href="/(tabs)" className="mt-2 py-4">
          <Text className="text-primary text-sm font-extrabold active:opacity-75">
            Go to home screen!
          </Text>
        </Link>
      </View>
    </>
  );
}
